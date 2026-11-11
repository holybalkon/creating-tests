// Збірка результату з частин, які записав ШІ (parts/NNN.json).
// Механічна робота: впорядкувати, пронумерувати, порахувати лічильники,
// підставити назву вкладки, заповнити rawText з рядків джерела, перевірити
// інваріанти й ПОКРИТТЯ документа (щоб жоден фрагмент не зник непомітно).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  jobPaths, readMeta, updateMeta, listPartFiles, readJson, writeJson,
} from './jobs.mjs';
import { plainText } from './chunk.mjs';
import { normalizeQuestion, normRange, normRanges, plain, rich } from './validate.mjs';

function rangesToText(ranges) {
  return ranges.map(([a, b]) => (a === b ? `L${a}` : `L${a}–L${b}`)).join(', ');
}

/** Групує номери рядків у діапазони, ігноруючи порожні рядки між ними. */
function groupLines(nums, lines) {
  const out = [];
  let cur = null;
  for (const n of nums) {
    if (cur) {
      let gapEmpty = true;
      for (let k = cur[1] + 1; k < n; k++) if (plainText(lines[k - 1]) !== '') gapEmpty = false;
      if (gapEmpty && n - cur[1] <= 3) { cur[1] = n; continue; }
      out.push(cur);
    }
    cur = [n, n];
  }
  if (cur) out.push(cur);
  return out;
}

export async function assemble(jobId, { final = false } = {}) {
  const p = jobPaths(jobId);
  const meta = await readMeta(jobId);
  if (!meta) throw new Error(`Завдання ${jobId} не знайдено.`);

  const source = await fs.readFile(p.source(meta.format), 'utf8');
  const lines = source.split('\n');
  const N = lines.length;
  const partFiles = await listPartFiles(jobId);

  const reportErrors = [];
  const reportWarnings = [];
  const items = [];
  const skipped = [];
  const tabs = [];
  const shared = new Map(); // id → { label, content, range } — спільні тексти для кількох завдань
  let sectionTitle = null;

  /** Текст рядків джерела дослівно (з інлайн-оформленням), абзаци → переноси. */
  const linesToRich = ([a, b]) => rich(lines.slice(a - 1, b).join('\n'));

  for (const file of partFiles) {
    let part;
    try {
      part = await readJson(path.join(p.parts, file));
    } catch (e) {
      reportErrors.push(`parts/${file}: невалідний JSON — ${e.message}`);
      continue;
    }
    if (!sectionTitle && part.sectionTitle) sectionTitle = plain(part.sectionTitle);
    for (const c of Array.isArray(part.sharedContexts) ? part.sharedContexts : []) {
      if (!c?.id) { reportWarnings.push(`parts/${file}: sharedContexts без "id".`); continue; }
      if (shared.has(c.id)) reportWarnings.push(`parts/${file}: sharedContexts id «${c.id}» повторюється — використано останній.`);
      shared.set(String(c.id), { label: c.label ? plain(c.label) : '', content: c.content ?? null, range: normRange(c.lines) });
    }
    (Array.isArray(part.questions) ? part.questions : []).forEach((raw, i) => {
      items.push({ raw, file, order: items.length, label: `parts/${file} #${i + 1}` });
    });
    for (const s of Array.isArray(part.skipped) ? part.skipped : []) {
      const range = normRange(s?.lines);
      if (!range) { reportWarnings.push(`parts/${file}: skipped без коректного "lines".`); continue; }
      skipped.push({ range, reason: plain(s.reason ?? ''), kind: s.kind });
      if (s.kind === 'tab' && s.title) tabs.push({ line: range[0], title: plain(s.title) });
    }
  }
  tabs.sort((a, b) => a.line - b.line);

  // --- нормалізація та перевірка кожного завдання ----------------------------
  const own = new Map(); // номер рядка → мітка завдання (для перетинів)
  const covered = new Set();
  const markCovered = ([a, b]) => { for (let k = a; k <= b; k++) covered.add(k); };
  skipped.forEach((s) => markCovered(s.range));

  for (const s of shared.values()) if (s.range) markCovered(s.range);

  /**
   * Розгортає посилання на тексти: {ref:"id"} / contextRefs:["id"] → спільний
   * текст; {label, lines:[a,b]} без content → дослівний текст цих рядків.
   */
  function expandContexts(raw, label, errs) {
    const out = [];
    const ranges = [];
    const entries = [
      ...(Array.isArray(raw.contextRefs) ? raw.contextRefs.map((ref) => ({ ref })) : []),
      ...(Array.isArray(raw.contexts) ? raw.contexts : []),
    ];
    for (const e of entries) {
      if (typeof e === 'string') { out.push({ content: e }); continue; }
      if (e?.ref !== undefined) {
        const s = shared.get(String(e.ref));
        if (!s) { errs.push(`Посилання на неіснуючий спільний текст «${e.ref}».`); continue; }
        const content = s.content ?? (s.range ? linesToRich(s.range) : '');
        out.push({ ...(s.label ? { label: s.label } : {}), content });
        if (s.range) ranges.push(s.range);
        continue;
      }
      const r = normRange(e?.lines);
      if (r && (r[0] < 1 || r[1] > N)) { errs.push(`Рядки тексту L${r[0]}–L${r[1]} поза межами документа.`); continue; }
      const content = e?.content ?? (r ? linesToRich(r) : '');
      out.push({ ...(e?.label ? { label: e.label } : {}), content });
      if (r) ranges.push(r);
    }
    if (!entries.length && raw.contexts === undefined) return { contexts: undefined, ranges };
    if (!out.length && entries.length) reportWarnings.push(`${label}: тексти до завдання порожні після розгортання.`);
    return { contexts: out, ranges };
  }

  const questions = [];
  for (const it of items) {
    const extraErrors = [];
    const { contexts, ranges: refRanges } = expandContexts(it.raw, it.label, extraErrors);
    const raw = contexts === undefined ? it.raw : { ...it.raw, contexts };
    const { q, errors, warnings } = normalizeQuestion(raw, { jobId });
    const range = normRange(it.raw.lines);
    const ctxRanges = [...normRanges(it.raw.contextLines), ...refRanges];

    if (!range) {
      reportWarnings.push(`${it.label}: немає "lines" — неможливо перевірити покриття й заповнити rawText.`);
    } else if (range[0] < 1 || range[1] > N) {
      extraErrors.push(`Рядки L${range[0]}–L${range[1]} поза межами документа (1–${N}).`);
    } else {
      markCovered(range);
      for (let k = range[0]; k <= range[1]; k++) {
        if (own.has(k) && plainText(lines[k - 1]) !== '') {
          extraErrors.push(`Рядок L${k} уже належить іншому завданню (${own.get(k)}) — можливе дублювання або неправильні межі.`);
          break;
        }
      }
      for (let k = range[0]; k <= range[1]; k++) if (!own.has(k)) own.set(k, it.label);

      const ownLines = lines.slice(range[0] - 1, range[1]);
      q.rawText = ownLines.map(plainText).filter(Boolean).join('\n');
      const hasImg = ownLines.some((l) => /<img\b/i.test(l));
      const attached = (q.images?.length ?? 0) + q.options.filter((o) => o.image).length
        + (q.blanks ?? []).reduce((a, b) => a + (b.options ?? []).filter((o) => o.image).length, 0);
      if (hasImg && !attached) extraErrors.push('У фрагменті документа є зображення, але його не прикріплено до завдання.');
    }
    ctxRanges.forEach((r) => { if (r[0] >= 1 && r[1] <= N) markCovered(r); });
    if (!q.rawText) q.rawText = '';

    if (!q.source && range) {
      const tab = [...tabs].reverse().find((t) => t.line <= range[0]);
      if (tab) q.source = tab.title;
    }

    if (extraErrors.length) {
      q.status = 'NeedsReview';
      q.issues = [...new Set([...q.issues, ...extraErrors])];
    }
    warnings.forEach((w) => reportWarnings.push(`${it.label}: ${w}`));
    questions.push({ q, range, order: it.order, label: it.label, errors: [...errors, ...extraErrors] });
  }

  // --- покриття документа -------------------------------------------------
  const maxCovered = covered.size ? Math.max(...covered) : 0;
  const scanTo = final ? N : maxCovered;
  const uncoveredNums = [];
  for (let k = 1; k <= scanTo; k++) {
    if (!covered.has(k) && plainText(lines[k - 1]) !== '') uncoveredNums.push(k);
  }
  const uncovered = groupLines(uncoveredNums, lines);

  if (final) {
    for (const [a, b] of uncovered) {
      const text = lines.slice(a - 1, b).map(plainText).filter(Boolean).join('\n');
      const tab = [...tabs].reverse().find((t) => t.line <= a);
      questions.push({
        q: {
          number: 0,
          type: 'single_choice',
          ...(tab ? { source: tab.title } : {}),
          questionText: text,
          options: [],
          correctMarkers: [],
          explanation: '',
          status: 'NeedsReview',
          issues: [`Фрагмент документа (${rangesToText([[a, b]])}) не віднесено до жодного завдання. Перевірте: це завдання, контекст чи службовий текст?`],
          rawText: text,
        },
        range: [a, b],
        order: Number.MAX_SAFE_INTEGER,
        label: `непокритий ${rangesToText([[a, b]])}`,
        errors: ['непокритий фрагмент'],
      });
    }
  }

  // --- порядок і нумерація ----------------------------------------------------
  questions.sort((x, y) => (x.range?.[0] ?? Infinity) - (y.range?.[0] ?? Infinity) || x.order - y.order);
  questions.forEach((it, i) => { it.q.number = i + 1; });

  const list = questions.map((it) => it.q);
  const readyCount = list.filter((q) => q.status === 'Ready').length;
  const result = {
    jobId,
    sectionTitle: sectionTitle || meta.originalName,
    sourceFile: meta.originalName,
    final,
    generatedAt: new Date().toISOString(),
    total: list.length,
    readyCount,
    needsReviewCount: list.length - readyCount,
    questions: list,
  };

  // --- звіт -----------------------------------------------------------------
  const typeCounts = {};
  list.forEach((q) => { typeCounts[q.type] = (typeCounts[q.type] ?? 0) + 1; });
  const chunksTotal = meta.chunks?.length ?? 0;
  const lineFor = (it) => (it.range ? rangesToText([it.range]) : 'без рядків');

  const report = [
    `Збірка ${jobId} — ${final ? 'ФІНАЛЬНА' : 'чернетка'} — ${result.generatedAt}`,
    `Частин розібрано: ${partFiles.length} з ${chunksTotal} · завдань: ${result.total} (готово ${readyCount}, увага ${result.needsReviewCount})`,
    `Типи: ${Object.entries(typeCounts).map(([t, c]) => `${t} ${c}`).join(', ') || '—'}`,
    `Покриття: перевірено рядки 1–${scanTo} з ${N}; непокритих фрагментів: ${uncovered.length}`,
    ...uncovered.slice(0, 50).map(([a, b]) => `  ${rangesToText([[a, b]])}: «${lines.slice(a - 1, b).map(plainText).filter(Boolean).join(' ').slice(0, 140)}»`),
    '',
    `Завдання з проблемами (→ NeedsReview): ${questions.filter((it) => it.errors.length).length}`,
    ...questions
      .filter((it) => it.errors.length)
      .slice(0, 200)
      .map((it) => `  #${it.q.number}${it.q.originalNumber ? ` (ориг. ${it.q.originalNumber})` : ''} ${lineFor(it)} [${it.q.type}]: ${it.errors.join(' | ')}`),
    '',
    `Помилки файлів: ${reportErrors.length}`,
    ...reportErrors.map((e) => `  ${e}`),
    `Попередження: ${reportWarnings.length}`,
    ...reportWarnings.slice(0, 100).map((w) => `  ${w}`),
  ].join('\n');

  await writeJson(final ? p.result : p.draft, result);
  await fs.writeFile(p.report, report + '\n', 'utf8');
  await updateMeta(jobId, {
    progress: { questions: result.total, partsDone: partFiles.length, chunksTotal },
    ...(final ? { status: 'done', finishedAt: result.generatedAt } : {}),
  });

  return { result, report };
}

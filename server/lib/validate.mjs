// Контроль якості розпізнаних завдань. Цей код НЕ розпізнає тести й не обирає
// тип — це робить ШІ. Тут лише механічна нормалізація (прибрати HTML-теги з
// варіантів, порахувати правильні маркери, виправити шляхи до картинок) і
// перевірка інваріантів кожного типу. Порушення не «виправляються мовчки»:
// завдання отримує статус NeedsReview і опис проблеми в issues.

export const QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'fill_in_blanks',
  'reading_comprehension',
  'matching',
];

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–',
  '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};

export function decodeEntities(s) {
  return String(s)
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Повністю плоский текст (для варіантів, пар, відповідей). */
export function plain(s) {
  if (s === null || s === undefined) return '';
  return decodeEntities(String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

const RICH_ALLOWED = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'br']);

/**
 * Текст із дозволеним інлайн-оформленням (жирний, курсив, підкреслення,
 * індекси, підсвітка). Абзаци → переноси рядків. Решта тегів і всі атрибути
 * (крім класу підсвітки hl-*) прибираються.
 */
export function rich(s) {
  if (s === null || s === undefined) return '';
  let out = String(s)
    .replace(/<\/(p|li|h[1-6]|tr|div|blockquote)>/gi, '\n')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?([a-z0-9]+)\b([^>]*)>/gi, (tag, nameRaw, attrs) => {
      const name = nameRaw.toLowerCase();
      if (!RICH_ALLOWED.has(name)) return '';
      if (name === 'br') return '<br>';
      if (tag.startsWith('</')) return `</${name}>`;
      if (name === 'mark') {
        const cls = /class="(hl-[A-Za-z]+)"/.exec(attrs);
        return cls ? `<mark class="${cls[1]}">` : '<mark>';
      }
      return `<${name}>`;
    });
  out = out
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out;
}

export function hasVisibleText(s) {
  return plain(s).length > 0;
}

const CHECK_SYMBOLS = /[✔✓✅☑✗✘❌]/u;

/** [a,b] | a | {from,to} → [a,b] або null. */
export function normRange(r) {
  if (r === null || r === undefined) return null;
  if (typeof r === 'number') return [r, r];
  if (Array.isArray(r) && r.length >= 1) {
    const a = Number(r[0]);
    const b = Number(r.length > 1 ? r[1] : r[0]);
    if (Number.isInteger(a) && Number.isInteger(b)) return a <= b ? [a, b] : [b, a];
    return null;
  }
  if (typeof r === 'object' && 'from' in r) return normRange([r.from, r.to ?? r.from]);
  return null;
}

/** contextLines може бути [a,b] або [[a,b],[c,d]]. */
export function normRanges(r) {
  if (!r) return [];
  if (Array.isArray(r) && r.length && Array.isArray(r[0])) return r.map(normRange).filter(Boolean);
  const one = normRange(r);
  return one ? [one] : [];
}

function normImage(img, jobId) {
  if (!img) return null;
  const srcRaw = typeof img === 'string' ? img : img.src;
  if (!srcRaw) return null;
  let src = String(srcRaw).trim();
  const asset = /(?:^|\/)(img-\d+\.[a-z0-9]+)$/i.exec(src);
  if (asset && !/^(https?:|data:)/i.test(src)) src = `/api/jobs/${jobId}/assets/${asset[1]}`;
  const alt = typeof img === 'object' && img.alt ? plain(img.alt) : '';
  return alt ? { src, alt } : { src };
}

function normOption(o, jobId) {
  const image = normImage(o?.image, jobId);
  const opt = {
    marker: plain(o?.marker ?? ''),
    text: plain(o?.text ?? ''),
    isCorrect: o?.isCorrect === true,
  };
  if (image) opt.image = image;
  return opt;
}

function checkOptions(options, label, errors) {
  if (options.length < 2) errors.push(`${label}: варіантів ${options.length}, потрібно щонайменше 2.`);
  const markers = options.map((o) => o.marker).filter(Boolean);
  if (new Set(markers).size !== markers.length) errors.push(`${label}: маркери варіантів повторюються (${markers.join(', ')}).`);
  options.forEach((o, i) => {
    if (!o.text && !o.image) errors.push(`${label}: варіант ${o.marker || i + 1} порожній.`);
    if (CHECK_SYMBOLS.test(o.text)) errors.push(`${label}: у тексті варіанта ${o.marker || i + 1} лишився символ-позначка правильності — студент побачить відповідь.`);
    if (o.marker && o.text.startsWith(o.marker) && /^[.)]\s/.test(o.text.slice(o.marker.length))) {
      errors.push(`${label}: маркер «${o.marker}» продубльовано в тексті варіанта («${o.text.slice(0, 24)}…»).`);
    }
  });
  const texts = options.map((o) => o.text.toLowerCase()).filter(Boolean);
  if (new Set(texts).size !== texts.length) errors.push(`${label}: є однакові варіанти відповіді.`);
}

/**
 * Нормалізує одне завдання, яке записав ШІ, і перевіряє інваріанти його типу.
 * Повертає { q, errors, warnings }. errors → NeedsReview + issues.
 */
export function normalizeQuestion(raw, { jobId }) {
  const errors = [];
  const warnings = [];
  const type = raw?.type;

  const q = {
    number: 0,
    type: QUESTION_TYPES.includes(type) ? type : 'single_choice',
  };
  if (!QUESTION_TYPES.includes(type)) errors.push(`Тип завдання не визначено або невідомий («${type ?? '—'}»).`);

  if (raw.source) q.source = plain(raw.source);
  if (Number.isFinite(Number(raw.originalNumber)) && raw.originalNumber !== null && raw.originalNumber !== '') {
    q.originalNumber = Number(raw.originalNumber);
  }
  if (Array.isArray(raw.tags)) {
    const tags = [...new Set(raw.tags.map(plain).filter(Boolean))];
    if (tags.length) q.tags = tags;
  }

  // Контексти: нове поле contexts[]; старе sharedContext мігруємо туди ж.
  const contexts = [];
  for (const c of Array.isArray(raw.contexts) ? raw.contexts : []) {
    const content = rich(typeof c === 'string' ? c : c?.content);
    if (!hasVisibleText(content)) continue;
    const label = typeof c === 'object' && c?.label ? plain(c.label) : '';
    contexts.push(label ? { label, content } : { content });
  }
  if (raw.sharedContext && hasVisibleText(raw.sharedContext)) {
    contexts.unshift({ content: rich(raw.sharedContext) });
  }
  if (contexts.length) q.contexts = contexts;

  q.questionText = rich(raw.questionText ?? '');

  const images = (Array.isArray(raw.images) ? raw.images : []).map((i) => normImage(i, jobId)).filter(Boolean);
  if (images.length) q.images = images;

  q.options = (Array.isArray(raw.options) ? raw.options : []).map((o) => normOption(o, jobId));
  q.correctMarkers = q.options.filter((o) => o.isCorrect).map((o) => o.marker);
  const correctCount = q.correctMarkers.length;

  if (raw.correctAnswer !== undefined && raw.correctAnswer !== null && plain(raw.correctAnswer)) {
    q.correctAnswer = plain(raw.correctAnswer);
  } else if (correctCount > 0) {
    q.correctAnswer = q.options.filter((o) => o.isCorrect).map((o) => o.text).join('; ');
  }

  // --- інваріанти за типом ---------------------------------------------------
  const needsStem = q.type !== 'fill_in_blanks';
  if (needsStem && !hasVisibleText(q.questionText)) {
    errors.push('Порожнє формулювання завдання (questionText). Якщо речення з пропуском чи умова опинились у contexts — перенесіть їх у questionText.');
  }

  if (q.type === 'single_choice') {
    checkOptions(q.options, 'Один варіант', errors);
    if (correctCount !== 1) errors.push(`Один варіант: позначено правильних ${correctCount}, потрібно рівно 1.`);
  }

  if (q.type === 'multiple_choice') {
    checkOptions(q.options, 'Кілька варіантів', errors);
    if (correctCount < 2) errors.push(`Кілька варіантів: позначено правильних ${correctCount}. Якщо правильний один — це тип «Один варіант».`);
  }

  if (q.type === 'reading_comprehension') {
    if (!q.contexts?.length) errors.push('Читання з текстом: немає тексту для читання (contexts). Якщо окремого тексту-джерела нема — це «Один варіант».');
    if (q.options.length) {
      checkOptions(q.options, 'Читання з текстом', errors);
      if (correctCount !== 1) errors.push(`Читання з текстом: позначено правильних ${correctCount}, потрібно рівно 1.`);
    } else if (!q.correctAnswer) {
      errors.push('Читання з текстом: немає ні варіантів, ні правильної відповіді.');
    }
  }

  if (q.type === 'fill_in_blanks') {
    q.blankText = rich(raw.blankText ?? '');
    const placeholders = [...q.blankText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const blanks = (Array.isArray(raw.blanks) ? raw.blanks : []).map((b) => {
      const blank = { index: Number(b?.index) };
      if (Array.isArray(b?.options) && b.options.length) {
        blank.options = b.options.map((o) => normOption(o, jobId));
      }
      const fromOptions = blank.options?.filter((o) => o.isCorrect).map((o) => o.text).join('; ');
      blank.answer = plain(b?.answer ?? '') || fromOptions || '';
      const acceptable = (Array.isArray(b?.acceptable) ? b.acceptable : []).map(plain).filter(Boolean);
      if (acceptable.length) blank.acceptable = acceptable;
      return blank;
    });
    q.blanks = blanks;

    if (!hasVisibleText(q.blankText)) errors.push('Текст із пропусками: немає blankText.');
    if (!placeholders.length) errors.push('Текст із пропусками: у blankText немає жодного пропуску {{N}}.');
    const pSet = [...new Set(placeholders)].sort((a, b) => a - b).join(',');
    const bSet = [...new Set(blanks.map((b) => b.index))].sort((a, b) => a - b).join(',');
    if (pSet !== bSet) errors.push(`Текст із пропусками: пропуски в тексті {${pSet}} не збігаються з відповідями {${bSet}}.`);
    for (const b of blanks) {
      if (!Number.isInteger(b.index)) errors.push('Текст із пропусками: пропуск без номера index.');
      if (b.options) {
        checkOptions(b.options, `Пропуск ${b.index}`, errors);
        const c = b.options.filter((o) => o.isCorrect).length;
        if (c !== 1) errors.push(`Пропуск ${b.index}: позначено правильних варіантів ${c}, потрібно рівно 1.`);
      } else if (!b.answer) {
        errors.push(`Пропуск ${b.index}: немає правильної відповіді.`);
      }
    }
  }

  if (q.type === 'matching') {
    q.pairs = (Array.isArray(raw.pairs) ? raw.pairs : []).map((p) => ({ left: plain(p?.left), right: plain(p?.right) }));
    const distractors = (Array.isArray(raw.distractors) ? raw.distractors : []).map(plain).filter(Boolean);
    if (distractors.length) q.distractors = distractors;
    if (q.pairs.length < 2) errors.push(`Зіставлення: пар ${q.pairs.length}, потрібно щонайменше 2.`);
    q.pairs.forEach((p, i) => {
      if (!p.left || !p.right) errors.push(`Зіставлення: пара ${i + 1} неповна.`);
    });
  }

  if (q.type !== 'fill_in_blanks' && raw.blanks?.length) warnings.push('Є blanks, але тип не «Текст із пропусками» — поле проігноровано.');
  if (q.type !== 'matching' && raw.pairs?.length) warnings.push('Є pairs, але тип не «Зіставлення» — поле проігноровано.');

  q.explanation = rich(raw.explanation ?? '');

  // Статус: ШІ може сам поставити NeedsReview; валідатор лише понижує, не підвищує.
  const aiIssues = (Array.isArray(raw.issues) ? raw.issues : []).map(plain).filter(Boolean);
  q.status = raw.status === 'NeedsReview' || errors.length ? 'NeedsReview' : 'Ready';
  q.issues = [...new Set([...aiIssues, ...errors])];

  return { q, errors, warnings };
}

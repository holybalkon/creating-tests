#!/usr/bin/env node
// Інструменти для ШІ (Kiro) під час розбору документа. Розпізнавання робить ШІ;
// ці команди лише показують чергу, план читання та збирають/перевіряють результат.
//
//   node server/cli.mjs queue                 — документи, що чекають на розбір
//   node server/cli.mjs start <jobId>         — позначити «в роботі» й показати план частин
//   node server/cli.mjs status <jobId>        — стан і прогрес
//   node server/cli.mjs assemble <jobId>      — зібрати чернетку з parts/ і перевірити
//   node server/cli.mjs assemble <jobId> --final — фінальна збірка (результат з'явиться в браузері)
//   node server/cli.mjs import-html <file.html> [назва] — створити завдання зі старого HTML

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  listJobs, readMeta, updateMeta, jobPaths, jobStage, jobProgress, ROOT,
} from './lib/jobs.mjs';
import { assemble } from './lib/assemble.mjs';
import { createJobFromHtml } from './lib/prepare.mjs';

const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

async function cmdQueue() {
  const jobs = (await listJobs()).filter((j) => j.status !== 'done');
  if (!jobs.length) {
    console.log('Черга порожня — немає документів, що чекають на розбір.');
    return;
  }
  for (const j of jobs) {
    const stage = await jobStage(j.jobId, j);
    const pr = await jobProgress(j.jobId, j);
    console.log(`${j.jobId}  [${stage}]  «${j.originalName}»  рядків ${j.lines}, частин ${pr.chunksTotal}, розібрано частин ${pr.partsDone}`);
  }
  console.log('\nДалі: node server/cli.mjs start <jobId>');
}

async function cmdStart(jobId) {
  const meta = await readMeta(jobId);
  if (!meta) throw new Error(`Завдання ${jobId} не знайдено.`);
  const p = jobPaths(jobId);
  const next = await updateMeta(jobId, {
    status: meta.status === 'done' ? 'done' : 'processing',
    startedAt: meta.startedAt ?? new Date().toISOString(),
  });
  const pr = await jobProgress(jobId, next);
  const done = new Set((await fs.readdir(p.parts).catch(() => [])).map((n) => n.replace('.json', '')));

  console.log(`Документ: «${meta.originalName}» (${meta.format}), рядків ${meta.lines}, зображень ${meta.images ?? 0}`);
  if (meta.extractWarnings?.length) console.log(`Попередження витягу: ${meta.extractWarnings.join(' | ')}`);
  console.log(`Статус: ${next.status} · етап: ${await jobStage(jobId, next)} · розібрано частин ${pr.partsDone} з ${pr.chunksTotal}`);
  console.log(`\nАналіз закономірностей: ${rel(p.analysis)} ${(await fs.access(p.analysis).then(() => true, () => false)) ? '(є)' : '(ще немає — написати після першого читання)'}`);
  console.log('\nЧастини для читання:');
  for (const c of meta.chunks) {
    const id = String(c.index).padStart(3, '0');
    console.log(`  ${done.has(id) ? '✓' : '·'} ${rel(path.join(p.chunks, c.file))}  L${c.from}–L${c.to}  → ${rel(path.join(p.parts, `${id}.json`))}`);
  }
  if (meta.images) console.log(`\nЗображення: ${rel(p.assets)}/img-NNN.* (у тексті — <img src="assets/img-NNN.*">)`);
}

async function cmdStatus(jobId) {
  const meta = await readMeta(jobId);
  if (!meta) throw new Error(`Завдання ${jobId} не знайдено.`);
  const pr = await jobProgress(jobId, meta);
  console.log(JSON.stringify({ jobId, originalName: meta.originalName, status: meta.status, stage: await jobStage(jobId, meta), ...pr }, null, 2));
}

async function cmdAssemble(jobId, final) {
  const { report } = await assemble(jobId, { final });
  console.log(report);
  console.log(`\nЗвіт: ${rel(jobPaths(jobId).report)}`);
}

async function cmdImportHtml(file, name) {
  const html = await fs.readFile(path.resolve(file), 'utf8');
  const meta = await createJobFromHtml({ html, originalName: name || path.basename(file) });
  console.log(`Створено ${meta.jobId}: рядків ${meta.lines}, частин ${meta.chunks.length}, зображень ${meta.images}`);
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === 'queue') await cmdQueue();
  else if (cmd === 'start') await cmdStart(a);
  else if (cmd === 'status') await cmdStatus(a);
  else if (cmd === 'assemble') await cmdAssemble(a, process.argv.includes('--final'));
  else if (cmd === 'import-html') await cmdImportHtml(a, b);
  else {
    console.log('Команди: queue | start <jobId> | status <jobId> | assemble <jobId> [--final] | import-html <file> [назва]');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Помилка: ${err.message}`);
  process.exitCode = 1;
}

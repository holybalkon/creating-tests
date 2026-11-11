// Сховище завдань пайплайна. Кожен завантажений документ — окрема папка
// pipeline/jobs/<jobId>/ з усім, що до нього стосується:
//
//   meta.json      — стан (queued → processing → done), назва файлу, план частин
//   source.html|txt— повний вміст документа, по одному блоку на рядок (без втрат)
//   chunks/NNN.txt — той самий вміст, порізаний на частини з глобальними номерами
//                    рядків (L00042| …) — зручно читати ШІ частинами
//   assets/        — зображення з DOCX
//   analysis.md    — закономірності документа, які визначив ШІ (пише ШІ)
//   parts/NNN.json — розпізнані завдання по частинах (пише ШІ)
//   draft.json     — проміжна збірка (assemble)
//   result.json    — фінальний результат (assemble --final)
//   report.txt     — звіт перевірки останньої збірки

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const PIPELINE = path.join(ROOT, 'pipeline');
export const JOBS = path.join(PIPELINE, 'jobs');

export const JOB_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function assertJobId(jobId) {
  if (!JOB_ID_RE.test(String(jobId ?? ''))) throw new Error(`Некоректний jobId: ${jobId}`);
}

export function jobPaths(jobId) {
  assertJobId(jobId);
  const dir = path.join(JOBS, jobId);
  return {
    dir,
    meta: path.join(dir, 'meta.json'),
    chunks: path.join(dir, 'chunks'),
    assets: path.join(dir, 'assets'),
    parts: path.join(dir, 'parts'),
    analysis: path.join(dir, 'analysis.md'),
    draft: path.join(dir, 'draft.json'),
    result: path.join(dir, 'result.json'),
    report: path.join(dir, 'report.txt'),
    source: (format) => path.join(dir, format === 'html' ? 'source.html' : 'source.txt'),
  };
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

/** Атомарний запис: пишемо в тимчасовий файл і перейменовуємо. */
export async function writeJson(p, data) {
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, p);
}

export async function readMeta(jobId) {
  try {
    return await readJson(jobPaths(jobId).meta);
  } catch {
    return null;
  }
}

/** Оновлює meta.json частково (merge верхнього рівня). */
export async function updateMeta(jobId, patch) {
  const current = (await readMeta(jobId)) ?? {};
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeJson(jobPaths(jobId).meta, next);
  return next;
}

export async function listPartFiles(jobId) {
  const dir = jobPaths(jobId).parts;
  try {
    return (await fs.readdir(dir)).filter((n) => /^\d+\.json$/.test(n)).sort();
  } catch {
    return [];
  }
}

/** Усі завдання, від найновішого до найстарішого. */
export async function listJobs() {
  let names = [];
  try {
    names = await fs.readdir(JOBS);
  } catch {
    return [];
  }
  const jobs = [];
  for (const name of names) {
    if (!JOB_ID_RE.test(name)) continue;
    const meta = await readMeta(name);
    if (meta) jobs.push(meta);
  }
  return jobs.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

/**
 * Етап для фронтенду. Рахується зі стану на диску, а не зі слів ШІ:
 *   queued    — документ підготовлено, ШІ ще не почав
 *   analyzing — ШІ взяв документ, але ще не записав analysis.md
 *   parsing   — закономірності визначено, ШІ розбирає частини
 *   done      — є result.json
 */
export async function jobStage(jobId, meta) {
  const p = jobPaths(jobId);
  if (await exists(p.result)) return 'done';
  if (!meta || meta.status === 'queued') return 'queued';
  if (!(await exists(p.analysis))) return 'analyzing';
  return 'parsing';
}

export async function jobProgress(jobId, meta) {
  const parts = await listPartFiles(jobId);
  return {
    chunksTotal: meta?.chunks?.length ?? 0,
    partsDone: parts.length,
    questions: meta?.progress?.questions ?? 0,
  };
}

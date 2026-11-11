// Pipeline backend. Приймає документ, розпаковує його без втрат оформлення,
// ріже на частини для читання ШІ і віддає стан/результат фронтенду.
// Розпізнавання тестів тут НЕМАЄ — його робить ШІ (Kiro), див. server/cli.mjs
// та .kiro/steering/test-parser-pipeline.md.
//
//   POST   /api/upload                 — новий документ (TXT, MD, DOCX)
//   GET    /api/jobs                   — список документів
//   GET    /api/result/:jobId          — етап, прогрес і результат (коли готовий)
//   GET    /api/jobs/:jobId/draft      — уже розібрані завдання (поки триває розбір)
//   GET    /api/jobs/:jobId/assets/:f  — зображення з документа
//   DELETE /api/jobs/:jobId            — видалити документ
//   DELETE /api/jobs                   — очистити все

import express from 'express';
import multer from 'multer';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  JOBS, jobPaths, readMeta, readJson, exists, listJobs, jobStage, jobProgress, JOB_ID_RE,
} from './lib/jobs.mjs';
import { createJobFromUpload } from './lib/prepare.mjs';

const PORT = 5176;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.txt', '.md', '.docx']);

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

function checkJobId(req, res, next) {
  if (!JOB_ID_RE.test(req.params.jobId)) return res.status(400).json({ error: 'Некоректний jobId.' });
  return next();
}

/** Публічна частина meta (без плану частин). */
function publicMeta(meta) {
  if (!meta) return null;
  const { chunks, extractWarnings, ...rest } = meta;
  return rest;
}

app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Файл завеликий (максимум ${MAX_FILE_BYTES / 1024 / 1024} МБ).` });
    }
    return err ? next(err) : next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не надіслано.' });

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return res.status(415).json({ error: `Непідтримуваний формат: ${ext || 'без розширення'}. Дозволено: TXT, MD, DOCX.` });
    }

    const meta = await createJobFromUpload({ buffer: req.file.buffer, originalName });
    if (!meta.lines || meta.chars < 2) {
      await fs.rm(jobPaths(meta.jobId).dir, { recursive: true, force: true });
      return res.status(422).json({ error: 'Документ порожній або текст не вдалося витягти.' });
    }
    console.log(`[pipeline] новий документ ${meta.jobId} «${originalName}»: рядків ${meta.lines}, частин ${meta.chunks.length}`);
    return res.json({
      jobId: meta.jobId,
      originalName,
      ext,
      format: meta.format,
      chars: meta.chars,
      chunks: meta.chunks.length,
      status: meta.status,
    });
  } catch (err) {
    console.error('[upload] помилка:', err);
    return res.status(500).json({ error: 'Не вдалося прочитати документ. Перевірте, що це коректний DOCX/TXT/MD.' });
  }
});

app.get('/api/jobs', async (_req, res) => {
  const jobs = await listJobs();
  const out = [];
  for (const j of jobs) {
    out.push({ ...publicMeta(j), stage: await jobStage(j.jobId, j), progress: await jobProgress(j.jobId, j) });
  }
  res.json({ jobs: out });
});

app.get('/api/result/:jobId', checkJobId, async (req, res) => {
  const { jobId } = req.params;
  const meta = await readMeta(jobId);
  if (!meta) return res.status(404).json({ error: 'Завдання не знайдено.' });

  const stage = await jobStage(jobId, meta);
  const progress = await jobProgress(jobId, meta);
  if (stage === 'done') {
    try {
      const result = await readJson(jobPaths(jobId).result);
      return res.json({ stage, progress, meta: publicMeta(meta), result });
    } catch (err) {
      console.error('[result] пошкоджений result.json:', err.message);
      return res.status(500).json({ error: 'Результат пошкоджено — потрібна повторна збірка.' });
    }
  }
  return res.json({ stage, progress, meta: publicMeta(meta) });
});

app.get('/api/jobs/:jobId/draft', checkJobId, async (req, res) => {
  const p = jobPaths(req.params.jobId);
  for (const file of [p.result, p.draft]) {
    if (await exists(file)) return res.json(await readJson(file));
  }
  return res.status(404).json({ error: 'Ще немає розібраних завдань.' });
});

app.get('/api/jobs/:jobId/assets/:file', checkJobId, async (req, res) => {
  const { file } = req.params;
  if (!/^img-\d+\.[a-z0-9]+$/i.test(file)) return res.status(400).end();
  const full = path.join(jobPaths(req.params.jobId).assets, file);
  if (!(await exists(full))) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.sendFile(full);
});

app.delete('/api/jobs/:jobId', checkJobId, async (req, res) => {
  await fs.rm(jobPaths(req.params.jobId).dir, { recursive: true, force: true });
  res.json({ ok: true });
});

async function clearAll() {
  const names = await fs.readdir(JOBS).catch(() => []);
  for (const n of names) {
    if (n === '.gitkeep') continue;
    await fs.rm(path.join(JOBS, n), { recursive: true, force: true });
  }
  return names.filter((n) => n !== '.gitkeep').length;
}

app.delete('/api/jobs', async (_req, res) => {
  const removed = await clearAll();
  console.log(`[pipeline] очищено документів: ${removed}`);
  res.json({ ok: true, removed });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] помилка:', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера.' });
});

await fs.mkdir(JOBS, { recursive: true });
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[pipeline] сервер: http://localhost:${PORT} · документи: ${JOBS}`);
});

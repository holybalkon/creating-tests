// Створення завдання: витяг вмісту → source → частини для читання → meta.json.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { jobPaths, writeJson } from './jobs.mjs';
import { extractDocx, htmlToLines, textToLines } from './extract.mjs';
import { writeChunks } from './chunk.mjs';

async function finishJob({ jobId, originalName, ext, format, lines, images = [], warnings = [] }) {
  const p = jobPaths(jobId);
  await fs.writeFile(p.source(format), lines.join('\n'), 'utf8');
  const chunks = await writeChunks({ lines, format, chunksDir: p.chunks, jobId });
  await fs.mkdir(p.parts, { recursive: true });

  const chars = lines.reduce((a, l) => a + l.length + 1, 0);
  const meta = {
    jobId,
    originalName,
    ext,
    format,
    sourceFile: path.basename(p.source(format)),
    uploadedAt: new Date().toISOString(),
    status: 'queued',
    chars,
    lines: lines.length,
    images: images.length,
    extractWarnings: warnings.slice(0, 20),
    chunks,
    progress: { questions: 0, partsDone: 0, chunksTotal: chunks.length },
  };
  await writeJson(p.meta, meta);
  return meta;
}

/** Новий документ із браузера. */
export async function createJobFromUpload({ buffer, originalName }) {
  const ext = path.extname(originalName).toLowerCase();
  const jobId = nanoid(10).replace(/[^A-Za-z0-9_-]/g, '_');
  const p = jobPaths(jobId);
  await fs.mkdir(p.dir, { recursive: true });

  try {
    if (ext === '.docx') {
      const { lines, images, warnings } = await extractDocx(buffer, p.assets);
      return await finishJob({ jobId, originalName, ext, format: 'html', lines, images, warnings });
    }
    const lines = textToLines(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    return await finishJob({ jobId, originalName, ext, format: 'text', lines });
  } catch (err) {
    await fs.rm(p.dir, { recursive: true, force: true });
    throw err;
  }
}

/** Імпорт уже витягнутого HTML (наприклад, зі старої версії пайплайна). */
export async function createJobFromHtml({ html, originalName }) {
  const jobId = nanoid(10).replace(/[^A-Za-z0-9_-]/g, '_');
  const p = jobPaths(jobId);
  await fs.mkdir(p.assets, { recursive: true });

  // base64-картинки виносимо у файли, як і при звичайному завантаженні.
  let n = 0;
  const images = [];
  const withAssets = await replaceAsync(html, /src="data:([^;"]+);base64,([^"]+)"/g, async (_m, type, data) => {
    n += 1;
    const sub = (type.split('/')[1] ?? 'bin').toLowerCase();
    const ext = (sub === 'jpeg' ? 'jpg' : sub).replace(/[^a-z0-9]/g, '') || 'bin';
    const name = `img-${String(n).padStart(3, '0')}.${ext}`;
    await fs.writeFile(path.join(p.assets, name), Buffer.from(data, 'base64'));
    images.push({ name, contentType: type });
    return `src="assets/${name}"`;
  });

  return finishJob({
    jobId,
    originalName,
    ext: '.docx',
    format: 'html',
    lines: htmlToLines(withAssets),
    images,
    warnings: ['Імпортовано зі старого HTML: підкреслення та підсвітка маркером могли бути втрачені під час попереднього витягу.'],
  });
}

async function replaceAsync(str, re, fn) {
  const tasks = [];
  str.replace(re, (...args) => { tasks.push(fn(...args)); return ''; });
  const results = await Promise.all(tasks);
  let i = 0;
  return str.replace(re, () => results[i++]);
}

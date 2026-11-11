import type { ParseResult } from '../types';

/**
 * Етап обробки, як його бачить бекенд (рахується зі стану файлів на диску):
 *   queued    — документ підготовлено, чекає на ШІ
 *   analyzing — ШІ читає документ і визначає його закономірності
 *   parsing   — ШІ розбирає частини документа
 *   done      — результат готовий
 */
export type PipelineStage = 'queued' | 'analyzing' | 'parsing' | 'done';

export interface JobProgress {
  chunksTotal: number;
  partsDone: number;
  questions: number;
}

export interface JobSummary {
  jobId: string;
  originalName: string;
  status: string;
  stage: PipelineStage;
  uploadedAt: string;
  startedAt?: string;
  finishedAt?: string;
  chars: number;
  progress: JobProgress;
}

export interface UploadResponse {
  jobId: string;
  originalName: string;
  ext: string;
  chars: number;
  chunks: number;
  status: string;
}

export interface ResultResponse {
  stage: PipelineStage;
  progress: JobProgress;
  result?: ParseResult;
  meta?: { originalName?: string; uploadedAt?: string };
}

/** Оцінка часу (у секундах) для кожного етапу конкретного документа. */
export interface StageEstimate {
  upload: number;
  extract: number;
  queue: number;
  analyze: number;
  parse: number;
  result: number;
}

/**
 * Приблизна оцінка за розміром документа. AI-розбір виконується у сесії Kiro,
 * тож це орієнтир, а не прогноз; реальний прогрес показують частини документа.
 */
export function estimateStages(chars: number, ext: string): StageEstimate {
  const kChars = chars / 1000;
  const isDocx = ext.toLowerCase() === '.docx';
  const round = (n: number) => Math.max(1, Math.round(n));
  return {
    upload: round(0.5 + kChars * 0.02),
    extract: round((isDocx ? 1.5 : 0.5) + kChars * (isDocx ? 0.08 : 0.03)),
    queue: 3,
    analyze: round(10 + kChars * 0.05),
    parse: round(20 + kChars * 1.2),
    result: round(2 + kChars * 0.02),
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return json(await fetch('/api/upload', { method: 'POST', body: form }));
}

export async function listJobs(): Promise<JobSummary[]> {
  const data = await json<{ jobs: JobSummary[] }>(await fetch('/api/jobs'));
  return data.jobs;
}

export async function clearJobs(): Promise<void> {
  await json(await fetch('/api/jobs', { method: 'DELETE' }));
}

export async function fetchResult(jobId: string): Promise<ResultResponse> {
  return json(await fetch(`/api/result/${encodeURIComponent(jobId)}`));
}

/** Уже розібрані завдання (чернетка), поки документ ще обробляється. */
export async function fetchDraft(jobId: string): Promise<ParseResult> {
  return json(await fetch(`/api/jobs/${encodeURIComponent(jobId)}/draft`));
}

/**
 * Опитує бекенд, доки не з'явиться результат. Без жорсткого тайм-ауту: великий
 * документ ШІ може розбирати довго. Зупиняється через signal.
 */
export async function pollResult(
  jobId: string,
  {
    intervalMs = 2000,
    onUpdate,
    signal,
  }: {
    intervalMs?: number;
    onUpdate?: (data: ResultResponse) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ParseResult> {
  let failures = 0;
  while (!signal?.aborted) {
    try {
      const data = await fetchResult(jobId);
      failures = 0;
      onUpdate?.(data);
      if (data.stage === 'done' && data.result) return data.result;
    } catch (err) {
      // Короткі збої (перезапуск бекенду) не обривають очікування.
      failures += 1;
      if (failures >= 15) throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new DOMException('Скасовано', 'AbortError');
}

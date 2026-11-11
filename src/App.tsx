import { useCallback, useEffect, useRef, useState } from 'react';
import { FileStack } from 'lucide-react';
import { UploadScreen } from './components/UploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ReviewScreen } from './components/ReviewScreen';
import {
  uploadDocument, pollResult, estimateStages, listJobs, clearJobs, fetchDraft,
} from './lib/pipelineApi';
import type { JobProgress, JobSummary, PipelineStage, StageEstimate } from './lib/pipelineApi';
import type { ParseResult } from './types';
import { DEMO_TYPES } from './data/demoTypes';

type Screen = 'upload' | 'processing' | 'review';

interface ActiveJob {
  jobId: string;
  fileName: string;
  startedAt: number;
  estimate: StageEstimate | null;
}

/**
 * Оркестратор: завантаження → обробка (опитування бекенду) → перевірка.
 * Розбір виконує ШІ у Kiro; стан зберігається на диску, тож після оновлення
 * сторінки незавершений документ підхоплюється автоматично.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [stage, setStage] = useState<PipelineStage>('queued');
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<JobSummary[]>([]);
  const pollRef = useRef<AbortController | null>(null);

  const refreshRecent = useCallback(async () => {
    try {
      setRecent(await listJobs());
    } catch {
      setRecent([]);
    }
  }, []);

  const follow = useCallback(async (next: ActiveJob) => {
    pollRef.current?.abort();
    const ctrl = new AbortController();
    pollRef.current = ctrl;
    setJob(next);
    setScreen('processing');
    try {
      const parsed = await pollResult(next.jobId, {
        signal: ctrl.signal,
        onUpdate: (d) => {
          setStage(d.stage);
          setProgress(d.progress);
        },
      });
      if (ctrl.signal.aborted) return;
      setResult(parsed);
      setScreen('review');
      refreshRecent();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Сталася помилка обробки.');
      setScreen('upload');
    }
  }, [refreshRecent]);

  // Після оновлення сторінки продовжуємо стежити за незавершеним документом.
  useEffect(() => {
    (async () => {
      const jobs = await listJobs().catch(() => [] as JobSummary[]);
      setRecent(jobs);
      const pending = jobs.find((j) => j.stage !== 'done');
      if (pending) {
        follow({
          jobId: pending.jobId,
          fileName: pending.originalName,
          startedAt: Date.parse(pending.uploadedAt) || Date.now(),
          estimate: estimateStages(pending.chars, pending.originalName.slice(pending.originalName.lastIndexOf('.'))),
        });
      }
    })();
    return () => pollRef.current?.abort();
  }, [follow]);

  async function handleFile(file: File) {
    setError(null);
    setStage('queued');
    setProgress(null);
    setResult(null);
    setJob({ jobId: '', fileName: file.name, startedAt: Date.now(), estimate: null });
    setScreen('processing');
    try {
      const up = await uploadDocument(file);
      follow({
        jobId: up.jobId,
        fileName: file.name,
        startedAt: Date.now(),
        estimate: estimateStages(up.chars, up.ext),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити файл.');
      setScreen('upload');
    }
  }

  async function openJob(j: JobSummary) {
    setError(null);
    if (j.stage !== 'done') {
      follow({ jobId: j.jobId, fileName: j.originalName, startedAt: Date.parse(j.uploadedAt) || Date.now(), estimate: null });
      return;
    }
    try {
      setResult(await fetchDraft(j.jobId));
      setJob({ jobId: j.jobId, fileName: j.originalName, startedAt: Date.now(), estimate: null });
      setScreen('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося відкрити результат.');
    }
  }

  async function viewDraft() {
    if (!job?.jobId) return;
    try {
      setResult(await fetchDraft(job.jobId));
      setScreen('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ще немає розібраних завдань.');
    }
  }

  function backToUpload() {
    pollRef.current?.abort();
    setResult(null);
    setJob(null);
    setError(null);
    setScreen('upload');
    refreshRecent();
  }

  async function handleClear() {
    pollRef.current?.abort();
    await clearJobs().catch(() => undefined);
    refreshRecent();
  }

  const isDraft = Boolean(result && result.final === false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <FileStack className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Імпорт тестів</h1>
            <p className="text-xs text-slate-500">Завантаження, розпізнавання та перевірка тестів із документа</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {screen === 'upload' && (
          <UploadScreen
            onFile={handleFile}
            error={error}
            onDemo={() => {
              setResult(DEMO_TYPES);
              setScreen('review');
            }}
            recent={recent}
            onOpenJob={openJob}
            onClear={handleClear}
          />
        )}
        {screen === 'processing' && job && (
          <ProcessingScreen
            fileName={job.fileName}
            stage={stage}
            progress={progress}
            startedAt={job.startedAt}
            estimate={job.estimate}
            onViewDraft={viewDraft}
          />
        )}
        {screen === 'review' && result && (
          <ReviewScreen
            result={result}
            onReset={backToUpload}
            isDraft={isDraft}
            onBackToProcessing={isDraft && job ? () => setScreen('processing') : undefined}
          />
        )}
      </main>
    </div>
  );
}

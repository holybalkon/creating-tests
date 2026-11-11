import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Circle, Clock, MessageSquare, Copy, Check, Eye } from 'lucide-react';
import type { JobProgress, PipelineStage, StageEstimate } from '../lib/pipelineApi';

interface Props {
  fileName: string;
  stage: PipelineStage;
  progress: JobProgress | null;
  /** Час старту обробки (Date.now()), щоб рахувати таймер. */
  startedAt: number;
  estimate: StageEstimate | null;
  /** Відкрити вже розібрані завдання, не чекаючи кінця. */
  onViewDraft?: () => void;
}

type StepKey = keyof StageEstimate;

const ORDER: PipelineStage[] = ['queued', 'analyzing', 'parsing', 'done'];

/**
 * doneFrom — з якого етапу крок вважається завершеним;
 * activeAt — на якому етапі крок триває зараз.
 */
const STEPS: { key: StepKey; label: string; doneFrom: PipelineStage; activeAt?: PipelineStage }[] = [
  { key: 'upload', label: 'Завантаження документа', doneFrom: 'queued' },
  { key: 'extract', label: 'Витяг тексту й оформлення', doneFrom: 'queued' },
  { key: 'queue', label: 'Очікування в черзі', doneFrom: 'analyzing', activeAt: 'queued' },
  { key: 'analyze', label: 'Аналіз структури документа', doneFrom: 'parsing', activeAt: 'analyzing' },
  { key: 'parse', label: 'Розпізнавання завдань', doneFrom: 'done', activeAt: 'parsing' },
  { key: 'result', label: 'Перевірка та збірка результату', doneFrom: 'done' },
];

function stepState(step: (typeof STEPS)[number], stage: PipelineStage): 'done' | 'active' | 'pending' {
  if (ORDER.indexOf(stage) >= ORDER.indexOf(step.doneFrom)) return 'done';
  if (step.activeAt === stage) return 'active';
  return 'pending';
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatEstimate(sec: number) {
  if (sec < 60) return `~${sec} с`;
  const m = Math.round(sec / 60);
  return m < 60 ? `~${m} хв` : `~${Math.floor(m / 60)} год ${m % 60} хв`;
}

function formatActual(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} хв ${sec % 60} с` : `${Math.floor(m / 60)} год ${m % 60} хв`;
}

/** Екран обробки: таймер, етапи (пройдено / триває / чекає) і реальний прогрес частин. */
export function ProcessingScreen({ fileName, stage, progress, startedAt, estimate, onViewDraft }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [doneAt, setDoneAt] = useState<Partial<Record<StepKey, number>>>({});
  const activeSinceRef = useRef<Partial<Record<StepKey, number>>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const now = Date.now() - startedAt;
    setDoneAt((prev) => {
      const next = { ...prev };
      for (const step of STEPS) {
        const st = stepState(step, stage);
        if (st === 'active' && activeSinceRef.current[step.key] === undefined) activeSinceRef.current[step.key] = now;
        if (st === 'done' && next[step.key] === undefined) next[step.key] = now;
      }
      return next;
    });
  }, [stage, startedAt]);

  function copyCue() {
    navigator.clipboard?.writeText('готово').then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  }

  const chunksTotal = progress?.chunksTotal ?? 0;
  const partsDone = progress?.partsDone ?? 0;
  const pct = chunksTotal ? Math.min(100, Math.round((partsDone / chunksTotal) * 100)) : 0;

  return (
    <div className="animate-fade-in mx-auto flex w-full max-w-xl flex-col items-center py-12 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <Loader2 className="absolute h-20 w-20 animate-spin text-indigo-200" strokeWidth={1.5} aria-hidden="true" />
      </div>

      <h2 className="text-lg font-semibold text-slate-800">Розбираємо документ…</h2>
      <p className="mt-1 max-w-sm truncate text-sm text-slate-500" title={fileName}>{fileName}</p>

      <div className="mt-4 flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="tabular-nums">{formatElapsed(elapsed)}</span>
        </div>
        {estimate && (
          <span className="text-xs text-slate-400">
            орієнтовно {formatEstimate(Object.values(estimate).reduce((a, b) => a + b, 0))}
          </span>
        )}
      </div>

      {stage === 'queued' && (
        <div className="mt-6 w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-left" role="status">
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Потрібна ваша дія</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                Документ підготовлено ({chunksTotal} {chunksTotal === 1 ? 'частина' : 'частин'}). Напишіть у чат Kiro{' '}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-semibold text-amber-900">готово</span>{' '}
                — і розбір почнеться. Сторінку можна оновлювати: завдання не загубиться.
              </p>
              <button
                onClick={copyCue}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? 'Скопійовано' : 'Скопіювати «готово»'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ol className="mt-8 w-full max-w-sm space-y-1 text-left">
        {STEPS.map((step) => {
          const state = stepState(step, stage);
          const est = estimate?.[step.key];
          let rightLabel: string | null = null;
          if (state === 'done') {
            const finishedAt = doneAt[step.key];
            const startedStep = activeSinceRef.current[step.key];
            rightLabel = finishedAt !== undefined && startedStep !== undefined ? formatActual(finishedAt - startedStep) : null;
          } else if (state === 'active') {
            rightLabel = formatActual(elapsed - (activeSinceRef.current[step.key] ?? elapsed));
          } else if (est !== undefined) {
            rightLabel = formatEstimate(est);
          }

          return (
            <li
              key={step.key}
              aria-current={state === 'active' ? 'step' : undefined}
              className={`rounded-lg px-3 py-2.5 transition-colors ${state === 'active' ? 'bg-indigo-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                {state === 'done' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="завершено" />}
                {state === 'active' && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600" aria-label="триває" />}
                {state === 'pending' && <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-label="очікує" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-sm ${state === 'done' ? 'text-slate-500' : state === 'active' ? 'font-medium text-indigo-700' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {state === 'done' && <span className="text-[11px] font-medium text-emerald-600">завершено</span>}
                </span>
                {rightLabel && (
                  <span className={`shrink-0 text-xs tabular-nums ${state === 'done' ? 'text-emerald-600' : state === 'active' ? 'text-indigo-500' : 'text-slate-300'}`}>
                    {rightLabel}
                  </span>
                )}
              </div>

              {step.key === 'parse' && chunksTotal > 0 && (state === 'active' || state === 'done') && (
                <div className="mt-2 pl-8">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Частин розібрано: {partsDone} з {chunksTotal} · завдань: {progress?.questions ?? 0}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {onViewDraft && (progress?.questions ?? 0) > 0 && stage !== 'done' && (
        <button
          onClick={onViewDraft}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Переглянути вже розібрані ({progress?.questions})
        </button>
      )}

      <p className="mt-6 max-w-sm text-xs text-slate-400">
        Праворуч від завершених етапів — фактичний час, у майбутніх — орієнтовна оцінка.
      </p>
    </div>
  );
}

import { useRef, useState } from 'react';
import { UploadCloud, FileText, AlertCircle, Trash2, ChevronRight } from 'lucide-react';
import type { JobSummary } from '../lib/pipelineApi';

interface Props {
  onFile: (file: File) => void;
  error?: string | null;
  onDemo?: () => void;
  recent?: JobSummary[];
  onOpenJob?: (job: JobSummary) => void;
  onClear?: () => void;
}

const STAGE_LABEL: Record<JobSummary['stage'], string> = {
  queued: 'у черзі',
  analyzing: 'аналіз структури',
  parsing: 'розпізнавання',
  done: 'готово',
};

const ACCEPT = '.txt,.md,.docx';
const ALLOWED_EXT = ['.txt', '.md', '.docx'];

function extOf(name: string) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

/**
 * Екран 1 — завантаження. Реальний drag-and-drop: приймає TXT/MD/DOCX,
 * валідує розширення й передає файл нагору через onFile.
 */
export function UploadScreen({ onFile, error, onDemo, recent = [], onOpenJob, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    setLocalError(null);
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!ALLOWED_EXT.includes(extOf(file.name))) {
      setLocalError(`Непідтримуваний формат «${file.name}». Дозволено: TXT, MD, DOCX.`);
      return;
    }
    onFile(file);
  }

  const shownError = localError ?? error;

  return (
    <div className="animate-fade-in mx-auto w-full max-w-2xl">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div
          className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
            dragOver ? 'bg-indigo-100' : 'bg-slate-100 group-hover:bg-indigo-100'
          }`}
        >
          <UploadCloud
            className={`h-10 w-10 transition-colors ${
              dragOver ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'
            }`}
          />
        </div>

        <h2 className="text-lg font-semibold text-slate-800">Перетягніть документ сюди</h2>
        <p className="mt-1 text-sm text-slate-500">
          або натисніть, щоб вибрати файл з комп'ютера
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <FileText className="h-4 w-4" />
          Вибрати файл
        </button>

        <p className="mt-4 text-xs text-slate-400">Формати: TXT, MD, DOCX</p>
      </div>

      {shownError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      {onDemo && (
        <div className="mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={onDemo}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            Переглянути приклади всіх типів завдань
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="recent-heading" className="text-sm font-semibold text-slate-700">Документи</h3>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Видалити всі документи та результати розбору? Це не можна скасувати.')) onClear();
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Очистити все
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {recent.map((j) => (
              <li key={j.jobId}>
                <button
                  type="button"
                  onClick={() => onOpenJob?.(j)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700">{j.originalName}</span>
                    <span className="text-xs text-slate-400">
                      {STAGE_LABEL[j.stage]}
                      {j.progress.questions ? ` · завдань: ${j.progress.questions}` : ''}
                      {j.stage !== 'done' && j.progress.chunksTotal ? ` · частин ${j.progress.partsDone}/${j.progress.chunksTotal}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

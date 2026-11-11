import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { ParsedQuestion, ParseResult, QuestionType } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';
import { QuestionCard } from './QuestionCard';
import { EditQuestionModal } from './EditQuestionModal';

interface Props {
  result: ParseResult;
  onReset: () => void;
  /** Чернетка: документ ще розбирається, показано лише готову частину. */
  isDraft?: boolean;
  onBackToProcessing?: () => void;
}

type FilterMode = 'all' | 'ready' | 'review';
type TypeFilter = QuestionType | 'all';
const PAGE_SIZE = 10;

/** Екран перевірки: статистика, фільтри (статус, тип, розділ), список із пагінацією. */
export function ReviewScreen({ result, onReset, isDraft, onBackToProcessing }: Props) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ParsedQuestion | null>(null);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of result.questions) {
      if (q.source) counts.set(q.source, (counts.get(q.source) ?? 0) + 1);
    }
    return counts;
  }, [result.questions]);

  // Які типи реально присутні в результаті + їхня кількість (для випадайки).
  const typeCounts = useMemo(() => {
    const counts = new Map<QuestionType, number>();
    for (const q of result.questions) {
      const t = (q.type ?? 'single_choice') as QuestionType;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  }, [result.questions]);

  const filtered = useMemo(() => {
    return result.questions.filter((q) => {
      if (filter === 'ready' && q.status !== 'Ready') return false;
      if (filter === 'review' && q.status !== 'NeedsReview') return false;
      if (typeFilter !== 'all' && (q.type ?? 'single_choice') !== typeFilter) return false;
      if (sourceFilter !== 'all' && q.source !== sourceFilter) return false;
      return true;
    });
  }, [result.questions, filter, typeFilter, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Ковзне вікно номерів сторінок навколо поточної.
  const pageNumbers = buildPageList(safePage, pageCount);

  function changeFilter(mode: FilterMode) {
    setFilter(mode);
    setPage(0);
  }

  function changeTypeFilter(t: TypeFilter) {
    setTypeFilter(t);
    setPage(0);
  }

  return (
    <div className="animate-fade-in mx-auto w-full max-w-3xl">
      {isDraft && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800" role="status">
          <span>Це проміжний результат — документ ще розбирається.</span>
          {onBackToProcessing && (
            <button onClick={onBackToProcessing} className="font-medium underline-offset-2 hover:underline">
              Повернутися до прогресу
            </button>
          )}
        </div>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<ListChecks className="h-5 w-5 text-slate-500" />}
          label="Усього тестів"
          value={result.total}
          tone="slate"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          label="Готово"
          value={result.readyCount}
          tone="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Потребує уваги"
          value={result.needsReviewCount}
          tone="amber"
        />
      </div>

      {/* Панель дій */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <FilterTab active={filter === 'all'} onClick={() => changeFilter('all')}>
            <Filter className="h-3.5 w-3.5" /> Усі ({result.total})
          </FilterTab>
          <FilterTab active={filter === 'ready'} onClick={() => changeFilter('ready')}>
            Готові ({result.readyCount})
          </FilterTab>
          <FilterTab active={filter === 'review'} onClick={() => changeFilter('review')}>
            Увага ({result.needsReviewCount})
          </FilterTab>
        </div>

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
        >
          <RotateCcw className="h-4 w-4" />
          Інший файл
        </button>
      </div>

      {/* Фільтр за типом завдання */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="type-filter" className="flex items-center gap-1.5 text-sm text-slate-500">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Тип:
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => changeTypeFilter(e.target.value as TypeFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="all">Усі типи ({result.questions.length})</option>
          {[...typeCounts.entries()].map(([t, count]) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]} ({count})
            </option>
          ))}
        </select>
        {sources.size > 1 && (
          <>
            <label htmlFor="source-filter" className="ml-2 text-sm text-slate-500">Розділ:</label>
            <select
              id="source-filter"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(0);
              }}
              className="min-w-0 max-w-[16rem] truncate rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">Усі розділи</option>
              {[...sources.entries()].map(([s, count]) => (
                <option key={s} value={s}>
                  {s} ({count})
                </option>
              ))}
            </select>
          </>
        )}
        {(typeFilter !== 'all' || sourceFilter !== 'all') && (
          <button
            onClick={() => {
              changeTypeFilter('all');
              setSourceFilter('all');
            }}
            className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Скинути
          </button>
        )}
      </div>

      {/* Список тестів */}
      <div className="mt-4 space-y-3">
        {pageItems.map((q) => (
          <QuestionCard key={q.number} question={q} onEdit={() => setEditing(q)} />
        ))}
        {pageItems.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            Немає тестів у цій категорії.
          </p>
        )}
      </div>

      {/* Пагінація */}
      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>
          <div className="flex items-center gap-1">
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={`min-w-[2rem] rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  n === safePage
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {n + 1}
              </button>
            ))}
          </div>
          <button
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Далі
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Фінальне збереження */}
      <div className="sticky bottom-0 mt-6 -mx-4 border-t border-slate-100 bg-white/80 px-4 py-4 backdrop-blur">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
          <Save className="h-4 w-4" />
          Зберегти все на платформу ({result.total})
        </button>
        {result.needsReviewCount > 0 && (
          <p className="mt-2 text-center text-xs text-amber-600">
            {result.needsReviewCount} тест(ів) потребує уваги — рекомендуємо перевірити перед збереженням.
          </p>
        )}
      </div>

      {editing && (
        <EditQuestionModal question={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/**
 * Будує список номерів сторінок (0-based) як ковзне вікно до WINDOW штук
 * навколо поточної сторінки. Дозволяє перескакувати на кілька сторінок одразу.
 * Якщо сторінок менше за вікно — показуємо всі.
 */
function buildPageList(current: number, total: number): number[] {
  const WINDOW = 9;
  if (total <= WINDOW) return Array.from({ length: total }, (_, i) => i);

  // Центруємо вікно на поточній сторінці, але не виходимо за межі.
  let start = current - Math.floor(WINDOW / 2);
  start = Math.max(0, Math.min(start, total - WINDOW));
  return Array.from({ length: WINDOW }, (_, i) => start + i);
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'amber';
}) {
  const ring = {
    slate: 'ring-slate-200',
    emerald: 'ring-emerald-200',
    amber: 'ring-amber-200',
  }[tone];

  return (
    <div className={`rounded-xl bg-white p-4 ring-1 ${ring}`}>
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

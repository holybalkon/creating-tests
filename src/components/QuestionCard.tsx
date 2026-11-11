import { Pencil, CheckCircle2, Circle, CheckSquare, Square, Tag } from 'lucide-react';
import type { AnswerOption, ParsedQuestion, QuestionImage } from '../types';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { RichText } from './RichText';

interface Props {
  question: ParsedQuestion;
  onEdit: () => void;
}

function Images({ images }: { images?: (QuestionImage | null | undefined)[] | null }) {
  const list = (images ?? []).filter((i): i is QuestionImage => Boolean(i?.src));
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((img, i) => (
        <img
          key={i}
          src={img.src}
          alt={img.alt ?? `Зображення ${i + 1} до завдання`}
          loading="lazy"
          className="max-h-48 rounded-lg border border-slate-200 bg-white object-contain"
        />
      ))}
    </div>
  );
}

/** Картка одного розпізнаного завдання. Вміст відмальовується залежно від типу. */
export function QuestionCard({ question, onEdit }: Props) {
  const type = question.type ?? 'single_choice';
  const contexts = [
    ...(question.sharedContext ? [{ content: question.sharedContext }] : []),
    ...(question.contexts ?? []),
  ];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-0.5 flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-lg bg-slate-100 px-1 text-sm font-semibold text-slate-600"
            title={question.originalNumber ? `У документі: №${question.originalNumber}` : undefined}
          >
            {question.number}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={type} />
              {question.source && (
                <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500" title={question.source}>
                  {question.source}
                  {question.originalNumber ? ` · №${question.originalNumber}` : ''}
                </span>
              )}
              {question.tags?.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  {t}
                </span>
              ))}
            </div>

            {contexts.length > 0 && (
              <div className="mb-2 space-y-2">
                {contexts.map((ctx, i) => (
                  <details
                    key={i}
                    open={contexts.length === 1 && ctx.content.length < 600}
                    className="rounded-md border-l-2 border-teal-300 bg-teal-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600"
                  >
                    <summary className="cursor-pointer select-none font-semibold text-teal-700">
                      {ctx.label || (contexts.length > 1 ? `Текст ${i + 1}` : 'Текст до завдання')}
                    </summary>
                    <RichText html={ctx.content} as="div" className="mt-1" />
                  </details>
                ))}
              </div>
            )}

            {question.questionText ? (
              <RichText html={question.questionText} as="p" className="font-medium text-slate-800" />
            ) : (
              type !== 'fill_in_blanks' && <p className="italic text-slate-400">Без тексту запитання</p>
            )}

            <Images images={question.images} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={question.status} />
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Редагувати
          </button>
        </div>
      </div>

      <div className="mt-3 pl-10">
        {(type === 'single_choice' || type === 'multiple_choice' || type === 'reading_comprehension') && (
          question.options.length > 0 ? (
            <OptionList options={question.options} multiple={type === 'multiple_choice'} />
          ) : question.correctAnswer ? (
            <p className="text-sm text-emerald-700">
              Відповідь: <span className="font-medium">{question.correctAnswer}</span>
            </p>
          ) : (
            <p className="text-xs italic text-slate-400">Немає варіантів відповіді.</p>
          )
        )}
        {type === 'fill_in_blanks' && <BlanksView question={question} />}
        {type === 'matching' && <MatchingView question={question} />}
      </div>

      {question.explanation && (
        <div className="ml-10 mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">Пояснення: </span>
          <RichText html={question.explanation} />
        </div>
      )}

      {question.issues.length > 0 && (
        <ul className="mt-3 space-y-1 pl-10">
          {question.issues.map((issue, i) => (
            <li key={i} className="text-xs text-amber-700">• {issue}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function OptionList({ options, multiple }: { options: AnswerOption[]; multiple: boolean }) {
  return (
    <ul className="space-y-1.5">
      {options.map((opt, i) => {
        const Icon = opt.isCorrect ? (multiple ? CheckSquare : CheckCircle2) : multiple ? Square : Circle;
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${opt.isCorrect ? 'text-emerald-500' : 'text-slate-300'}`}
              aria-label={opt.isCorrect ? 'Правильна відповідь' : undefined}
            />
            <span
              className={`flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded px-1 text-xs font-medium ${
                opt.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {opt.marker}
            </span>
            <span className={opt.isCorrect ? 'font-medium text-emerald-700' : 'text-slate-600'}>
              {opt.text}
              <Images images={opt.image ? [opt.image] : null} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Текст із підсвіченими пропусками + відповіді (або варіанти) до кожного пропуску. */
function BlanksView({ question }: { question: ParsedQuestion }) {
  const blanks = question.blanks ?? [];
  const parts = (question.blankText ?? '').split(/(\{\{\d+\}\})/g);
  return (
    <div className="space-y-3">
      {question.blankText && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {parts.map((part, i) => {
            const m = /^\{\{(\d+)\}\}$/.exec(part);
            if (m) {
              return (
                <span key={i} className="mx-0.5 inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-700">
                  ({m[1]}) ____
                </span>
              );
            }
            return <RichText key={i} html={part} />;
          })}
        </p>
      )}
      {blanks.length > 0 ? (
        <ul className="space-y-2">
          {blanks.map((b) => (
            <li key={b.index} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-sky-100 px-1 text-xs font-semibold text-sky-700">
                  {b.index}
                </span>
                {!b.options && <span className="font-medium text-emerald-700">{b.answer || '—'}</span>}
                {b.acceptable && b.acceptable.length > 0 && (
                  <span className="text-xs text-slate-400">(також: {b.acceptable.join(', ')})</span>
                )}
              </div>
              {b.options && (
                <div className="mt-1 pl-7">
                  <OptionList options={b.options} multiple={false} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-slate-400">Відповіді до пропусків не визначено.</p>
      )}
    </div>
  );
}

function MatchingView({ question }: { question: ParsedQuestion }) {
  const pairs = question.pairs ?? [];
  if (pairs.length === 0) {
    return <p className="text-xs italic text-slate-400">Пари для зіставлення не визначено.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {pairs.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1 rounded-md bg-slate-50 px-2 py-1 text-slate-700">{p.left}</span>
            <span className="text-slate-400" aria-hidden="true">↔</span>
            <span className="flex-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">{p.right}</span>
          </li>
        ))}
      </ul>
      {question.distractors && question.distractors.length > 0 && (
        <p className="text-xs text-slate-500">
          Зайві варіанти: {question.distractors.join(' · ')}
        </p>
      )}
    </div>
  );
}

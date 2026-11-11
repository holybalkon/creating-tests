import { X, Plus, Trash2, Check } from 'lucide-react';
import type { ParsedQuestion, QuestionType } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';
import { toPlainText } from './RichText';

interface Props {
  question: ParsedQuestion;
  onClose: () => void;
}

const TYPE_OPTIONS: QuestionType[] = [
  'single_choice',
  'multiple_choice',
  'fill_in_blanks',
  'reading_comprehension',
  'matching',
];

/**
 * Модальне вікно редагування тесту. Показує поля відповідно до типу завдання.
 * (Прев'ю — поля заповнені, без збереження стану.)
 */
export function EditQuestionModal({ question, onClose }: Props) {
  const type = question.type ?? 'single_choice';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-800">
            Редагувати тест №{question.number}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Тіло */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Тип завдання */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Тип завдання</label>
            <select
              defaultValue={type}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Великі тексти для reading_comprehension */}
          {type === 'reading_comprehension' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Тексти для читання
              </label>
              <div className="space-y-3">
                {(question.contexts ?? []).map((ctx, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <input
                      defaultValue={ctx.label ?? ''}
                      placeholder="Мітка (напр. «Текст А»)"
                      className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <textarea
                      defaultValue={toPlainText(ctx.content)}
                      rows={4}
                      className="w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
                <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  <Plus className="h-3.5 w-3.5" />
                  Додати текст
                </button>
              </div>
            </div>
          )}

          {/* Текст запитання */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Текст запитання
            </label>
            <textarea
              defaultValue={toPlainText(question.questionText)}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Варіанти — для single/multiple/reading */}
          {(type === 'single_choice' ||
            type === 'multiple_choice' ||
            type === 'reading_comprehension') && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Варіанти відповідей
                  <span className="ml-2 font-normal text-slate-400">
                    {type === 'multiple_choice' ? '(можна кілька правильних)' : '(один правильний)'}
                  </span>
                </label>
                <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  <Plus className="h-3.5 w-3.5" />
                  Додати
                </button>
              </div>
              <div className="space-y-2">
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      defaultValue={opt.marker}
                      className="w-12 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm outline-none focus:border-indigo-500"
                    />
                    <input
                      defaultValue={opt.text}
                      placeholder="Текст варіанту"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    <button
                      title="Позначити як правильну"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        opt.isCorrect
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      title="Видалити варіант"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Пропуски — для fill_in_blanks */}
          {type === 'fill_in_blanks' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Текст із пропусками
                  <span className="ml-2 font-normal text-slate-400">
                    (пропуски позначай {'{{1}}'}, {'{{2}}'}…)
                  </span>
                </label>
                <textarea
                  defaultValue={toPlainText(question.blankText ?? '')}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Відповіді до пропусків</label>
                  <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                    <Plus className="h-3.5 w-3.5" />
                    Додати пропуск
                  </button>
                </div>
                <div className="space-y-2">
                  {(question.blanks ?? []).map((b) => (
                    <div key={b.index} className="flex items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sm font-semibold text-sky-700">
                        {b.index}
                      </span>
                      <input
                        defaultValue={b.answer}
                        placeholder="Правильна відповідь"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                      <button
                        title="Видалити пропуск"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Пари — для matching */}
          {type === 'matching' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Пари для зіставлення</label>
                <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  <Plus className="h-3.5 w-3.5" />
                  Додати пару
                </button>
              </div>
              <div className="space-y-2">
                {(question.pairs ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      defaultValue={p.left}
                      placeholder="Ліва частина"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400">↔</span>
                    <input
                      defaultValue={p.right}
                      placeholder="Права частина"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    <button
                      title="Видалити пару"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Пояснення */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Пояснення <span className="font-normal text-slate-400">(необов'язково)</span>
            </label>
            <textarea
              defaultValue={toPlainText(question.explanation)}
              rows={2}
              placeholder="Пояснення до правильної відповіді"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Підвал */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Скасувати
          </button>
          <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            Зберегти зміни
          </button>
        </div>
      </div>
    </div>
  );
}

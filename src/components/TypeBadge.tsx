import { ListChecks, CheckSquare, TextCursorInput, BookOpen, ArrowLeftRight } from 'lucide-react';
import type { QuestionType } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';

interface Props {
  type: QuestionType;
}

const CONFIG: Record<
  QuestionType,
  { icon: React.ReactNode; className: string }
> = {
  single_choice: {
    icon: <ListChecks className="h-3.5 w-3.5" />,
    className: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  multiple_choice: {
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    className: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  fill_in_blanks: {
    icon: <TextCursorInput className="h-3.5 w-3.5" />,
    className: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  reading_comprehension: {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    className: 'bg-teal-50 text-teal-700 ring-teal-200',
  },
  matching: {
    icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
};

/** Кольоровий бейдж типу завдання. */
export function TypeBadge({ type }: Props) {
  const cfg = CONFIG[type] ?? CONFIG.single_choice;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cfg.className}`}
    >
      {cfg.icon}
      {QUESTION_TYPE_LABELS[type] ?? type}
    </span>
  );
}

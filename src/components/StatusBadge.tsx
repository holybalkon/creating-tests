import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ParseStatus } from '../types';

interface Props {
  status: ParseStatus;
}

/** Кольоровий бейдж статусу тесту: зелений "Готово" / жовтий "Потребує уваги". */
export function StatusBadge({ status }: Props) {
  if (status === 'Ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Готово
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
      <AlertTriangle className="h-3.5 w-3.5" />
      Потребує уваги
    </span>
  );
}

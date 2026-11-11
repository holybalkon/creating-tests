// Нарізка документа на частини для читання ШІ. Код НЕ шукає завдань і не
// вирішує, де закінчується питання: він лише ділить довгий документ по межах
// рядків (блоків), щоб ШІ міг прочитати його повністю, частина за частиною.
// Кожен рядок має глобальний номер L<N>, тож завдання, що переходить через
// межу частин, ШІ просто дочитує в наступній частині — нічого не рветься.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_CHARS = 40_000;

/** Видимий текст рядка (для оцінки «порожніх» рядків-роздільників). */
export function plainText(line) {
  return line
    .replace(/<img\b[^>]*>/gi, ' [зображення] ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Рядок для читання: прибираємо лише невидимі закладки Word (<a id="_…"></a>). */
function readingLine(line, format) {
  if (format !== 'html') return line;
  return line.replace(/<a id="[^"]*"><\/a>/g, '');
}

/**
 * Ділить рядки на частини ≤ maxChars. Ближче до ліміту намагається різати після
 * порожнього рядка-роздільника, щоб частина не закінчувалась посеред блоку.
 */
export function planChunks(lines, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const chunks = [];
  let from = 0;
  let size = 0;

  const flush = (toExclusive) => {
    chunks.push({ index: chunks.length + 1, from: from + 1, to: toExclusive });
    from = toExclusive;
    size = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    size += lines[i].length + 1;
    const nearLimit = size >= maxChars * 0.85;
    const separator = plainText(lines[i]) === '';
    if ((nearLimit && separator) || size >= maxChars) flush(i + 1);
  }
  if (from < lines.length) flush(lines.length);
  return chunks;
}

export async function writeChunks({ lines, format, chunksDir, jobId, maxChars }) {
  await fs.rm(chunksDir, { recursive: true, force: true });
  await fs.mkdir(chunksDir, { recursive: true });

  const plan = planChunks(lines, { maxChars });
  const width = String(lines.length).length;

  for (const c of plan) {
    const file = `${String(c.index).padStart(3, '0')}.txt`;
    const header = [
      `# Документ ${jobId} · частина ${c.index} з ${plan.length} · рядки L${c.from}–L${c.to} з ${lines.length}`,
      '# Формат: L<номер>| <рядок документа>. Номери глобальні — посилайся на них у "lines".',
      '',
    ];
    const body = [];
    for (let n = c.from; n <= c.to; n++) {
      body.push(`L${String(n).padStart(width, '0')}| ${readingLine(lines[n - 1], format)}`);
    }
    await fs.writeFile(path.join(chunksDir, file), header.concat(body).join('\n') + '\n', 'utf8');
    c.file = file;
    c.chars = body.reduce((a, l) => a + l.length + 1, 0);
  }
  return plan;
}

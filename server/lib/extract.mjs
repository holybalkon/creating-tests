// Витяг вмісту документа БЕЗ інтерпретації. Код лише розпаковує файл і
// зберігає максимум оформлення; що означає жирний, підсвітка чи номер —
// вирішує ШІ, читаючи результат.

import mammoth from 'mammoth';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HIGHLIGHT_COLORS = [
  'yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan',
  'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray', 'black',
];

// За замовчуванням mammoth ВИКИДАЄ підкреслення, підсвітку маркером та капітель.
// Ці мапінги повертають їх у HTML, бо в тестах ними часто позначають відповіді
// або службові позначки («жовтим виділено …»).
const STYLE_MAP = [
  'u => u',
  'strike => s',
  'small-caps => span.small-caps',
  ...HIGHLIGHT_COLORS.map((c) => `highlight[color='${c}'] => mark.hl-${c}`),
  'highlight => mark',
];

const BLOCK_START = /<(p|h[1-6]|table|tr|ul|ol|li|blockquote)(?=[\s>])/gi;

/** Один блок HTML на рядок. Додаються лише переноси між тегами — вміст не змінюється. */
export function htmlToLines(html) {
  return html
    .replace(BLOCK_START, '\n<$1')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}

/** Текстові документи: рядки як є. */
export function textToLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/**
 * DOCX → рядки HTML. Зображення зберігаються файлами в assetsDir, у HTML на них
 * посилання assets/img-NNN.ext (а не мегабайти base64 посеред тексту).
 */
export async function extractDocx(buffer, assetsDir) {
  await fs.mkdir(assetsDir, { recursive: true });
  let n = 0;
  const images = [];

  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        n += 1;
        const sub = (image.contentType?.split('/')[1] ?? 'bin').toLowerCase();
        const ext = (sub === 'jpeg' ? 'jpg' : sub).replace(/[^a-z0-9]/g, '') || 'bin';
        const name = `img-${String(n).padStart(3, '0')}.${ext}`;
        await fs.writeFile(path.join(assetsDir, name), Buffer.from(await image.readAsArrayBuffer()));
        images.push({ name, contentType: image.contentType });
        return { src: `assets/${name}` };
      }),
    },
  );

  const warnings = messages
    .filter((m) => m.type === 'warning' || m.type === 'error')
    .map((m) => m.message);

  return { lines: htmlToLines(html), images, warnings };
}

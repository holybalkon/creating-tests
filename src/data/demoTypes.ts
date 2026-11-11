import type { ParseResult } from '../types';

// Демо-дані з прикладом КОЖНОГО типу завдання — щоб переглянути, як кожен
// тип виглядає в UI (картка + редактор). Використовується лише для прев'ю.
export const DEMO_TYPES: ParseResult = {
  sectionTitle: 'Демонстрація типів завдань',
  sourceFile: 'demo',
  total: 5,
  readyCount: 4,
  needsReviewCount: 1,
  questions: [
    {
      number: 1,
      type: 'single_choice',
      questionText: 'Яка столиця України?',
      options: [
        { marker: 'А', text: 'Львів', isCorrect: false },
        { marker: 'Б', text: 'Київ', isCorrect: true },
        { marker: 'В', text: 'Одеса', isCorrect: false },
        { marker: 'Г', text: 'Харків', isCorrect: false },
      ],
      correctMarkers: ['Б'],
      explanation: 'Київ — столиця України.',
      status: 'Ready',
      issues: [],
      rawText: '',
    },
    {
      number: 2,
      type: 'multiple_choice',
      questionText: 'Які з міст розташовані в Україні?',
      options: [
        { marker: 'А', text: 'Львів', isCorrect: true },
        { marker: 'Б', text: 'Варшава', isCorrect: false },
        { marker: 'В', text: 'Дніпро', isCorrect: true },
        { marker: 'Г', text: 'Краків', isCorrect: false },
      ],
      correctMarkers: ['А', 'В'],
      explanation: 'Львів і Дніпро — українські міста.',
      status: 'Ready',
      issues: [],
      rawText: '',
    },
    {
      number: 3,
      type: 'fill_in_blanks',
      questionText: 'Заповніть пропуски у реченні.',
      blankText: 'Столиця України — {{1}}, а столиця Польщі — {{2}}.',
      blanks: [
        {
          index: 1,
          answer: 'Київ',
          options: [
            { marker: 'А', text: 'Київ', isCorrect: true },
            { marker: 'Б', text: 'Львів', isCorrect: false },
            { marker: 'В', text: 'Одеса', isCorrect: false },
          ],
        },
        { index: 2, answer: 'Варшава', acceptable: ['Warszawa'] },
      ],
      options: [],
      correctMarkers: [],
      explanation: '',
      status: 'Ready',
      issues: [],
      rawText: '',
    },
    {
      number: 4,
      type: 'reading_comprehension',
      contexts: [
        {
          label: 'Текст А',
          content:
            'Мова — це система знаків, що служить засобом спілкування людей. Вона розвивається разом із суспільством і відображає його культуру.',
        },
        {
          label: 'Текст Б',
          content:
            'Писемність виникла пізніше за усне мовлення й дала змогу зберігати знання поколінь.',
        },
      ],
      questionText: 'Що, згідно з Текстом А, є основною функцією мови?',
      options: [
        { marker: 'А', text: 'Засіб спілкування', isCorrect: true },
        { marker: 'Б', text: 'Прикраса мовлення', isCorrect: false },
        { marker: 'В', text: 'Збереження знань', isCorrect: false },
      ],
      correctMarkers: ['А'],
      explanation: 'У Тексті А прямо сказано, що мова служить засобом спілкування.',
      status: 'Ready',
      issues: [],
      rawText: '',
    },
    {
      number: 5,
      type: 'matching',
      questionText: 'Зіставте автора з твором.',
      pairs: [
        { left: 'Т. Шевченко', right: '«Кобзар»' },
        { left: 'І. Франко', right: '«Захар Беркут»' },
        { left: 'Леся Українка', right: '«Лісова пісня»' },
      ],
      distractors: ['«Енеїда»'],
      options: [],
      correctMarkers: [],
      explanation: '',
      status: 'NeedsReview',
      issues: ['Перевірте відповідність пар — розпізнано автоматично.'],
      rawText: '',
    },
  ],
};

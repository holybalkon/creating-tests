// Модель даних тесту. Описує типи завдань, які розпізнає ШІ з документа,
// а фронтенд показує й редагує. Збирає й перевіряє ці дані server/lib/assemble.mjs.

export type ParseStatus = 'Ready' | 'NeedsReview';

export type QuestionType =
  | 'single_choice' // один правильний варіант із кількох (А/Б/В/Г)
  | 'multiple_choice' // кілька правильних варіантів
  | 'fill_in_blanks' // текст із пропусками, до кожного — своя відповідь
  | 'reading_comprehension' // окремий текст (або кілька) + питання до нього
  | 'matching'; // зіставлення пар (ліве ↔ праве)

/** Зображення, прикріплене до питання, контексту чи варіанта. */
export interface QuestionImage {
  src: string;
  alt?: string;
}

/** Варіант відповіді. */
export interface AnswerOption {
  marker: string;
  text: string;
  isCorrect: boolean;
  image?: QuestionImage | null;
}

/** Один пропуск у завданні fill_in_blanks. */
export interface Blank {
  index: number;
  /** Правильна відповідь (для пропуску з варіантами — текст правильного варіанта). */
  answer: string;
  acceptable?: string[];
  /** Варіанти саме для цього пропуску, якщо їх пропонує документ. */
  options?: AnswerOption[];
}

/** Окремий текст для читання (Текст А, Текст Б…). Може містити інлайн-оформлення. */
export interface PassageText {
  label?: string;
  content: string;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface ParsedQuestion {
  /** Наскрізний номер у результаті (1…N). */
  number: number;
  type: QuestionType;

  /** Назва вкладки/розділу документа, з якого завдання. */
  source?: string;
  /** Номер завдання так, як він стоїть у документі. */
  originalNumber?: number;
  /** Службові позначки з легенди документа (напр. «вже на платформі»). */
  tags?: string[];

  /** Тексти-джерела (уривки, ситуації, умови спільні для групи завдань). */
  contexts?: PassageText[];
  /** Застаріле поле старих результатів; нові результати використовують contexts. */
  sharedContext?: string | null;

  /** Формулювання завдання. Може містити <strong>, <em>, <u>, <sub>, <sup>, <mark>, <br>. */
  questionText: string;
  images?: QuestionImage[];

  options: AnswerOption[];
  correctMarkers: string[];
  correctAnswer?: string;

  /** fill_in_blanks: текст, де пропуски позначені {{1}}, {{2}}… */
  blankText?: string;
  blanks?: Blank[];

  /** matching: правильні пари та зайві варіанти правої колонки. */
  pairs?: MatchPair[];
  distractors?: string[];

  explanation: string;
  status: ParseStatus;
  issues: string[];
  rawText: string;
}

export interface ParseResult {
  jobId?: string;
  sectionTitle?: string;
  sourceFile?: string;
  /** false — це чернетка, документ ще розбирається. */
  final?: boolean;
  questions: ParsedQuestion[];
  total: number;
  readyCount: number;
  needsReviewCount: number;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Один варіант',
  multiple_choice: 'Кілька варіантів',
  fill_in_blanks: 'Текст із пропусками',
  reading_comprehension: 'Читання з текстом',
  matching: 'Зіставлення',
};

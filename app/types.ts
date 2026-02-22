export type QuestionType = "single";

export interface QuestionAsset {
  type: string;
  src: string;
  alt?: string;
}

export interface Question {
  id: string;
  subject: string;
  year: number | null;
  chapter: string;
  type: QuestionType;
  question_text: string;
  options: [string, string, string, string];
  answer_index: 0 | 1 | 2 | 3;
  explanation: string;
  source: string;
  /** 可讀來源（例：105 第2頁 第51題），若有則優先顯示 */
  source_display?: string;
  /** v1.2.1：圖題裁切圖，若有則顯示在題幹區 */
  assets?: QuestionAsset[];
}

export interface QuizState {
  questionIds: string[];
  answers: Record<string, number>; // id -> selected index
  currentIndex: number;
}

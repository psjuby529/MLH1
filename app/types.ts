export type QuestionType = "single";

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
}

export interface QuizState {
  questionIds: string[];
  answers: Record<string, number>; // id -> selected index
  currentIndex: number;
}

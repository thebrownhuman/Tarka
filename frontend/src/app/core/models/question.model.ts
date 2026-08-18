export type QuestionType = 'single_choice' | 'multi_choice';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface CandidateQuestion {
  id: string;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[];
  questionType: QuestionType;
  selectedOptionIds: string[] | null;
  passageText?: string | null;
}

export interface QuestionResponse extends CandidateQuestion {
  remainingSeconds: number;
}

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface AdminQuestion {
  id: string;
  domain: string;
  topic: string;
  subpattern: string | null;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  passageId: string | null;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdminQuestionListResponse {
  items: AdminQuestion[];
  total: number;
  offset: number;
  limit: number;
}

export interface UploadQuestionInput {
  domain: string;
  topic: string;
  subpattern?: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  passageId?: string;
  passageText?: string;
  questionText: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
}

export interface UploadQuestionsResponse {
  inserted: number;
}

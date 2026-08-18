export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum QuestionType {
  SINGLE_CHOICE = 'single_choice',
  MULTI_CHOICE = 'multi_choice',
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionEntity {
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
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

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

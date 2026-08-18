export type TestAttemptStatus = 'in_progress' | 'submitted' | 'expired';

export interface StartAttemptResponse {
  attemptId: string;
  remainingSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  status: TestAttemptStatus;
}

export interface AdvanceNextResponse {
  currentQuestionIndex: number;
  completed: boolean;
}

export interface SubmitTestResponse {
  score: number;
  totalQuestions: number;
}

export interface ExtensionRequestResponse {
  id: string;
  status: 'pending' | 'approved' | 'denied';
}

export interface AttemptHistoryItem {
  id: string;
  test: { id: string; title: string };
  status: TestAttemptStatus;
  submittedAt: string | null;
  resultsReleasedAt: string | null;
  score: number | null;
}

export interface AttemptHistoryListResponse {
  items: AttemptHistoryItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface AttemptDetailAnswer {
  questionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  questionType: string;
  options: { id: string; text: string }[];
  passageText: string | null;
  correctOptionIds: string[];
  explanation: string;
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  timeSpentSeconds: number | null;
  answeredAt: string | null;
}

export interface AttemptDetailResponse {
  attemptId: string;
  testId: string;
  testTitle: string;
  status: TestAttemptStatus;
  score: number | null;
  totalQuestions: number;
  submittedAt: string | null;
  resultsReleasedAt: string | null;
  answers: AttemptDetailAnswer[];
}

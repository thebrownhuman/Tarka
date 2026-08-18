export interface TestAttemptAnswerEntity {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  servedAt: Date;
  answeredAt: Date | null;
  timeSpentSeconds: number | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export enum TestAttemptStatus {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  EXPIRED = 'expired',
}

export interface TestAttemptEntity {
  id: string;
  testId: string;
  candidateId: string;
  status: TestAttemptStatus;
  startedAt: Date;
  baseDurationSeconds: number;
  extendedSeconds: number;
  currentQuestionIndex: number;
  submittedAt: Date | null;
  score: number | null;
  resultsReleasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

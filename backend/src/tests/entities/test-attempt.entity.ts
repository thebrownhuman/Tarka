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
  /** Only meaningful once resultsReleasedAt is set: true = candidate sees the
   * correct option + explanation on every question; false = candidate only
   * sees whether their own answer was right or wrong. */
  resultsIncludeAnswers: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

import { TestAttemptStatus } from './test-attempt.model';

export interface AttemptSummary {
  id: string;
  candidate: { id: string; loginId: string; displayName: string };
  test: { id: string; title: string };
  status: TestAttemptStatus;
  score: number | null;
  currentQuestionIndex: number;
  startedAt: string;
  submittedAt: string | null;
  resultsReleasedAt: string | null;
}

export interface AttemptSummaryListResponse {
  items: AttemptSummary[];
  total: number;
  offset: number;
  limit: number;
}

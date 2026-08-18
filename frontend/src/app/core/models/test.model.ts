export interface AvailableTest {
  id: string;
  title: string;
  durationSeconds: number;
  activeAttemptId: string | null;
}

export interface AvailableTestsResponse {
  tests: AvailableTest[];
}

export interface CreateTestResponse {
  id: string;
  title: string;
  durationSeconds: number;
  questionCount: number;
  createdAt: string;
}

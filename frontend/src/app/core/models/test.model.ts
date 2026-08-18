export interface AvailableTest {
  id: string;
  title: string;
  durationSeconds: number;
}

export interface AvailableTestsResponse {
  tests: AvailableTest[];
}

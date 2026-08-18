export interface TestQuestionEntity {
  id: string;
  testId: string;
  questionId: string;
  position: number;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

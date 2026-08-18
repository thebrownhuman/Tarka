export interface TestEntity {
  id: string;
  title: string;
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

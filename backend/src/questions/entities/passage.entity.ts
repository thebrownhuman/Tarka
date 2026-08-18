export interface PassageEntity {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

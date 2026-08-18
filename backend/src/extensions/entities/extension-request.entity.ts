export enum ExtensionRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
}

export interface ExtensionRequestEntity {
  id: string;
  attemptId: string;
  requestedSeconds: number | null;
  status: ExtensionRequestStatus;
  grantedSeconds: number | null;
  adminNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

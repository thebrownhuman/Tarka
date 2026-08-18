export type ExtensionRequestStatus = 'pending' | 'approved' | 'denied';

export interface ExtensionRequestItem {
  id: string;
  attemptId: string;
  requestedSeconds: number;
  status: ExtensionRequestStatus;
  grantedSeconds: number | null;
  adminNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExtensionRequestListResponse {
  items: ExtensionRequestItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface ApproveExtensionResponse {
  id: string;
  status: ExtensionRequestStatus;
  grantedSeconds: number | null;
  resolvedAt: string | null;
  attempt: {
    id: string;
    status: string;
    baseDurationSeconds: number;
    extendedSeconds: number;
  };
}

export interface DenyExtensionResponse {
  id: string;
  status: ExtensionRequestStatus;
  adminNote: string | null;
  resolvedAt: string | null;
}

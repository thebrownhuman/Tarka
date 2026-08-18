export interface Candidate {
  id: string;
  loginId: string;
  displayName: string;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CandidateListResponse {
  items: Candidate[];
  total: number;
  offset: number;
  limit: number;
}

export interface CreateCandidateResponse {
  loginId: string;
  password: string;
}

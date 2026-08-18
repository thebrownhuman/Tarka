export type UserRole = 'admin' | 'candidate';

export interface Session {
  role: UserRole;
  displayName: string;
  mustChangePassword: boolean;
}

export interface LoginResponse extends Session {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

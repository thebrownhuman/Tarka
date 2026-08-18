export enum UserRole {
  ADMIN = 'admin',
  CANDIDATE = 'candidate',
}

export interface UserEntity {
  id: string;
  loginId: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

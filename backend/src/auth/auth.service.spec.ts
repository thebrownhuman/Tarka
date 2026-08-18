import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { UserRole } from '../users/entities/user.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';
import * as passwordUtil from './password.util';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let refreshTokensRepository: jest.Mocked<RefreshTokensRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const activeUser = {
    id: 'user-1',
    loginId: 'candidate001',
    passwordHash: 'hashed-password',
    role: UserRole.CANDIDATE,
    displayName: 'Candidate One',
    mustChangePassword: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    usersRepository = {
      byLoginIdActive: jest.fn(),
      byId: jest.fn(),
      updateLastLogin: jest.fn(),
      updatePasswordAndFlag: jest.fn(),
      insert: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    refreshTokensRepository = {
      insert: jest.fn(),
      byTokenHashActive: jest.fn(),
      revokeById: jest.fn(),
      revokeByTokenHash: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;

    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '7d',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new AuthService(usersRepository, refreshTokensRepository, jwtService, configService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('login', () => {
    it('issues access + refresh tokens on success', async () => {
      usersRepository.byLoginIdActive.mockResolvedValue(activeUser);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

      const result = await service.login('candidate001', 'correct-password');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.role).toBe(UserRole.CANDIDATE);
      expect(result.mustChangePassword).toBe(false);
      expect(usersRepository.updateLastLogin).toHaveBeenCalledWith(activeUser.id);
      expect(refreshTokensRepository.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects with generic error when login_id does not exist', async () => {
      usersRepository.byLoginIdActive.mockResolvedValue(null);

      await expect(service.login('unknown', 'whatever')).rejects.toMatchObject({
        response: { code: AppErrorCode.INVALID_CREDENTIALS },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('rejects with the same generic error when the password is wrong', async () => {
      usersRepository.byLoginIdActive.mockResolvedValue(activeUser);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

      await expect(service.login('candidate001', 'wrong')).rejects.toMatchObject({
        response: { code: AppErrorCode.INVALID_CREDENTIALS },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('rejects inactive users', async () => {
      usersRepository.byLoginIdActive.mockResolvedValue({ ...activeUser, isActive: false });

      await expect(service.login('candidate001', 'correct-password')).rejects.toBeInstanceOf(AppException);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and returns a new access token', async () => {
      refreshTokensRepository.byTokenHashActive.mockResolvedValue({
        id: 'rt-1',
        userId: activeUser.id,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
      });
      usersRepository.byId.mockResolvedValue(activeUser);

      const result = await service.refresh('some-refresh-token');

      expect(refreshTokensRepository.revokeById).toHaveBeenCalledWith('rt-1');
      expect(refreshTokensRepository.insert).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects an unknown/expired/revoked refresh token', async () => {
      refreshTokensRepository.byTokenHashActive.mockResolvedValue(null);

      await expect(service.refresh('bad-token')).rejects.toMatchObject({
        response: { code: AppErrorCode.INVALID_REFRESH_TOKEN },
        status: HttpStatus.UNAUTHORIZED,
      });
    });
  });

  describe('changePassword', () => {
    it('flips must_change_password to false on success', async () => {
      usersRepository.byId.mockResolvedValue({ ...activeUser, mustChangePassword: true });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
      jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('new-hash');

      await service.changePassword(activeUser.id, 'old-password', 'new-password123');

      expect(usersRepository.updatePasswordAndFlag).toHaveBeenCalledWith(activeUser.id, 'new-hash', false);
    });

    it('rejects when the current password is wrong', async () => {
      usersRepository.byId.mockResolvedValue(activeUser);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

      await expect(service.changePassword(activeUser.id, 'wrong', 'new-password123')).rejects.toMatchObject({
        response: { code: AppErrorCode.WRONG_CURRENT_PASSWORD },
      });
    });
  });
});

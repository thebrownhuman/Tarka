import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';
import { parseDurationToSeconds } from '../common/utils/duration.util';
import { generateRefreshToken, hashRefreshToken, verifyPassword, hashPassword } from './password.util';
import { UserRole } from '../users/entities/user.entity';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  displayName: string;
  mustChangePassword: boolean;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginId: string, password: string): Promise<LoginResult> {
    const user = await this.usersRepository.byLoginIdActive(loginId);

    // Constant-shape error regardless of which part was wrong (spec edge case 1) -
    // never reveal whether the login_id exists.
    if (!user || !user.isActive) {
      throw new AppException(AppErrorCode.INVALID_CREDENTIALS, 'Invalid login ID or password.', HttpStatus.UNAUTHORIZED);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppException(AppErrorCode.INVALID_CREDENTIALS, 'Invalid login ID or password.', HttpStatus.UNAUTHORIZED);
    }

    await this.usersRepository.updateLastLogin(user.id);

    const accessToken = this.signAccessToken(user.id);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      role: user.role,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const existing = await this.refreshTokensRepository.byTokenHashActive(tokenHash);
    if (!existing) {
      throw new AppException(AppErrorCode.INVALID_REFRESH_TOKEN, 'Refresh token is invalid, expired, or revoked.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.usersRepository.byId(existing.userId);
    if (!user || !user.isActive) {
      throw new AppException(AppErrorCode.INVALID_REFRESH_TOKEN, 'Refresh token is invalid, expired, or revoked.', HttpStatus.UNAUTHORIZED);
    }

    // Rotate: revoke the old token and issue a brand new one, so a leaked/replayed
    // refresh token can only ever be used once before detection.
    await this.refreshTokensRepository.revokeById(existing.id);

    const accessToken = this.signAccessToken(user.id);
    const newRefreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.refreshTokensRepository.revokeByTokenHash(tokenHash);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.byId(userId);
    if (!user) {
      throw new AppException(AppErrorCode.USER_NOT_FOUND, 'User not found.', HttpStatus.NOT_FOUND);
    }

    const passwordMatches = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new AppException(AppErrorCode.WRONG_CURRENT_PASSWORD, 'Current password is incorrect.', HttpStatus.BAD_REQUEST);
    }

    const newHash = await hashPassword(newPassword);
    await this.usersRepository.updatePasswordAndFlag(user.id, newHash, false);
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const ttlSeconds = parseDurationToSeconds(this.configService.get<string>('JWT_REFRESH_TTL', '7d'));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.refreshTokensRepository.insert(userId, tokenHash, expiresAt);
    return rawToken;
  }
}

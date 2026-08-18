import { HttpStatus, Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { UserRole } from '../users/entities/user.entity';
import { AppException } from '../common/errors/app.exception';
import { AppErrorCode } from '../common/errors/app-error-code';
import { generateOneTimePassword, hashPassword } from '../auth/password.util';

export interface OneTimeCredentials {
  loginId: string;
  password: string;
}

@Injectable()
export class AdminCandidatesService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createCandidate(loginId: string, displayName: string): Promise<OneTimeCredentials> {
    const existing = await this.usersRepository.byLoginIdActive(loginId);
    if (existing) {
      throw new AppException(AppErrorCode.LOGIN_ID_TAKEN, `login_id "${loginId}" is already in use.`, HttpStatus.CONFLICT);
    }

    const oneTimePassword = generateOneTimePassword();
    const passwordHash = await hashPassword(oneTimePassword);

    await this.usersRepository.insert({
      loginId,
      passwordHash,
      role: UserRole.CANDIDATE,
      displayName,
      mustChangePassword: true,
    });

    return { loginId, password: oneTimePassword };
  }

  async resetPassword(userId: string): Promise<OneTimeCredentials> {
    const user = await this.usersRepository.byId(userId);
    if (!user) {
      throw new AppException(AppErrorCode.USER_NOT_FOUND, 'User not found.', HttpStatus.NOT_FOUND);
    }

    const oneTimePassword = generateOneTimePassword();
    const passwordHash = await hashPassword(oneTimePassword);
    await this.usersRepository.updatePasswordAndFlag(user.id, passwordHash, true);

    return { loginId: user.loginId, password: oneTimePassword };
  }
}

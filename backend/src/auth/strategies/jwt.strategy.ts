import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersRepository } from '../../users/users.repository';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // Always re-read from DB (not the JWT claims) so must_change_password and
    // is_active reflect the current state, closing the stale-token window.
    const user = await this.usersRepository.byId(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    return {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword,
    };
  }
}

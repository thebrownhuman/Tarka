import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminCandidatesService } from './admin-candidates.service';
import { CreateCandidateDto } from '../auth/dto/create-candidate.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/candidates')
@Roles(UserRole.ADMIN)
export class AdminCandidatesController {
  constructor(private readonly adminCandidatesService: AdminCandidatesService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@Body() dto: CreateCandidateDto) {
    const credentials = await this.adminCandidatesService.createCandidate(dto.login_id, dto.display_name);
    return { login_id: credentials.loginId, password: credentials.password };
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const credentials = await this.adminCandidatesService.resetPassword(dto.user_id);
    return { login_id: credentials.loginId, password: credentials.password };
  }
}

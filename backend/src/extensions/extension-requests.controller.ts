import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ExtensionRequestService } from './extension-request.service';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/extension-requests')
@Roles(UserRole.CANDIDATE)
export class ExtensionRequestsController {
  constructor(private readonly extensionRequestService: ExtensionRequestService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('request')
  async request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestExtensionDto) {
    const request = await this.extensionRequestService.requestExtension(
      dto.attempt_id,
      user.id,
      dto.requested_seconds,
    );
    return { id: request.id, status: request.status };
  }
}

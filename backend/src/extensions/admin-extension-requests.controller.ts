import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ExtensionRequestService } from './extension-request.service';
import { ListExtensionRequestsDto } from './dto/list-extension-requests.dto';
import { ApproveExtensionDto } from './dto/approve-extension.dto';
import { DenyExtensionDto } from './dto/deny-extension.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ExtensionRequestStatus } from './entities/extension-request.entity';

// JwtAuthGuard, MustChangePasswordGuard, and RolesGuard are registered globally
// (see auth.module.ts APP_GUARD providers) - @Roles() here is all this controller needs.
@Controller('api/v1/admin/extension-requests')
@Roles(UserRole.ADMIN)
export class AdminExtensionRequestsController {
  constructor(private readonly extensionRequestService: ExtensionRequestService) {}

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListExtensionRequestsDto) {
    const result = await this.extensionRequestService.listAll(
      dto.status as ExtensionRequestStatus | undefined,
      dto.offset,
      dto.limit,
    );

    return {
      items: result.items.map((item) => ({
        id: item.id,
        attempt_id: item.attemptId,
        requested_seconds: item.requestedSeconds,
        status: item.status,
        granted_seconds: item.grantedSeconds,
        admin_note: item.adminNote,
        resolved_by: item.resolvedBy,
        resolved_at: item.resolvedAt,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('approve')
  async approve(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApproveExtensionDto) {
    const result = await this.extensionRequestService.approve(dto.request_id, dto.granted_seconds, user.id);

    return {
      id: result.request.id,
      status: result.request.status,
      granted_seconds: result.request.grantedSeconds,
      resolved_at: result.request.resolvedAt,
      attempt: {
        id: result.attempt.id,
        status: result.attempt.status,
        base_duration_seconds: result.attempt.baseDurationSeconds,
        extended_seconds: result.attempt.extendedSeconds,
      },
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('deny')
  async deny(@CurrentUser() user: AuthenticatedUser, @Body() dto: DenyExtensionDto) {
    const request = await this.extensionRequestService.deny(dto.request_id, dto.admin_note, user.id);

    return {
      id: request.id,
      status: request.status,
      admin_note: request.adminNote,
      resolved_at: request.resolvedAt,
    };
  }
}

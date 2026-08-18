import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { AllowWhenMustChangePassword } from './decorators/allow-when-must-change-password.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.login_id, dto.password);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      role: result.role,
      display_name: result.displayName,
      must_change_password: result.mustChangePassword,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto.refresh_token);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refresh_token);
    return { success: true };
  }

  @AllowWhenMustChangePassword()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.current_password, dto.new_password);
    return { success: true };
  }

  @AllowWhenMustChangePassword()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      role: user.role,
      display_name: user.displayName,
      must_change_password: user.mustChangePassword,
    };
  }
}

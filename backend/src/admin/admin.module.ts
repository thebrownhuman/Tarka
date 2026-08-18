import { Module } from '@nestjs/common';
import { AdminCandidatesController } from './admin-candidates.controller';
import { AdminCandidatesService } from './admin-candidates.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { UsersModule } from '../users/users.module';
import { TestsModule } from '../tests/tests.module';

@Module({
  imports: [UsersModule, TestsModule],
  controllers: [AdminCandidatesController, AdminDashboardController],
  providers: [AdminCandidatesService, AdminDashboardService],
})
export class AdminModule {}

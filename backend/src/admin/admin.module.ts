import { Module } from '@nestjs/common';
import { AdminCandidatesController } from './admin-candidates.controller';
import { AdminCandidatesService } from './admin-candidates.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AdminCandidatesController],
  providers: [AdminCandidatesService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { ExtensionRequestsRepository } from './extension-requests.repository';
import { ExtensionRequestService } from './extension-request.service';
import { ExtensionRequestsController } from './extension-requests.controller';
import { AdminExtensionRequestsController } from './admin-extension-requests.controller';
import { TestsModule } from '../tests/tests.module';

@Module({
  imports: [TestsModule],
  controllers: [ExtensionRequestsController, AdminExtensionRequestsController],
  providers: [ExtensionRequestsRepository, ExtensionRequestService],
})
export class ExtensionsModule {}

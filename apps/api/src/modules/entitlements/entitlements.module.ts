import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, PrismaService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}

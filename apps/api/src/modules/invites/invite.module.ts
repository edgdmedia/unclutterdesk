import { Module } from '@nestjs/common';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';
import { InviteCron } from './invite.cron';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [InviteController],
  providers: [InviteService, InviteCron, PrismaService],
  exports: [InviteService],
})
export class InviteModule {}

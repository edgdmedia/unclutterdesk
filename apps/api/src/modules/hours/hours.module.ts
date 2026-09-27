import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HoursController } from './hours.controller';
import { HoursService } from './hours.service';

@Module({
  controllers: [HoursController],
  providers: [HoursService, PrismaService],
})
export class HoursModule {}

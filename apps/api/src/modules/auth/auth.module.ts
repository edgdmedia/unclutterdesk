import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { CsrfGuard } from './csrf.guard';
import { SessionService } from './session.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../common/auth.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    JwtStrategy,
    PrismaService,
    CsrfGuard,
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService, SessionService, JwtModule],
})
export class AuthModule {}

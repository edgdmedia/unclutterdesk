import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JWT_SECRET, ACCESS_COOKIE } from '../../common/auth.config';

export interface JwtPayload {
  sub: string;
  profileId?: string;
  email?: string;
  tenantId?: string;
  type?: string;
  roles?: string[];
  /** Refresh session id. Present on tokens issued once sessions existed. */
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[ACCESS_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      profileId: payload.profileId,
      email: payload.email,
      tenantId: payload.tenantId,
      type: payload.type || 'user',
      roles: payload.roles || ['client'],
      sessionId: payload.sid,
    };
  }
}

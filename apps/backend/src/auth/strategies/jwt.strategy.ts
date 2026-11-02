import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";

import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../auth.service";
import { activeSessionUser } from "../session-access";

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.["access_token"] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Bearer header first (server-to-server callers like the Next.js BFF, which has
      // no backend cookies of its own), falling back to the cookie (browser/curl callers).
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await activeSessionUser(this.prisma, payload);
    return { userId: user.userId, role: user.role, sessionId: user.sessionId };
  }
}

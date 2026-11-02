import { createHash, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import type { User } from "@porisrom/database";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import type { LoginDto } from "./dto/login.dto";
import type { SignupDto } from "./dto/signup.dto";

export interface JwtPayload {
  sub: string;
  role: string | null;
  sid?: string;
  tid?: string;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.db.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
    });

    return this.buildAuthPayload(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== "active") {
      throw new ForbiddenException("Account is not active");
    }

    return this.buildAuthPayload(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (!payload.sid) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await this.prisma.db.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const now = new Date();
    if (session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (session.tokenHash !== this.hashToken(refreshToken)) {
      // Overlapping browser/server requests must not revoke a successful rotation.
      // No tokens are returned to the stale caller, even during this collision window.
      if (now.getTime() - session.updatedAt.getTime() < 5000) {
        throw new ConflictException("Refresh already rotated; retry with the current session cookie");
      }
      const replay = await this.prisma.db.authSession.updateMany({
        where: { id: session.id, tokenHash: session.tokenHash, revokedAt: null },
        data: { revokedAt: now, reuseDetectedAt: now },
      });
      if (replay.count === 1) this.realtime?.disconnectSession(session.id);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = session.user;
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokens = this.issueTokens(user.id, user.role, session.id);
    const rotated = await this.prisma.db.authSession.updateMany({
      where: { id: session.id, userId: user.id, tokenHash: this.hashToken(refreshToken), revokedAt: null, expiresAt: { gt: now } },
      data: {
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.refreshExpiresAt(tokens.refreshToken),
        updatedAt: now,
      },
    });
    if (rotated.count !== 1) {
      throw new ConflictException("Refresh already rotated or revoked");
    }
    return { user: this.sanitize(user), ...tokens };
  }

  async logout(sessionId?: string) {
    if (!sessionId) throw new UnauthorizedException("Missing session");
    await this.prisma.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.realtime?.disconnectSession(sessionId);
  }

  async logoutUsingTokens(accessToken?: string, refreshToken?: string) {
    let payload: JwtPayload | undefined;
    for (const [token, secret] of [[accessToken, "JWT_ACCESS_SECRET"], [refreshToken, "JWT_REFRESH_SECRET"]] as const) {
      if (!token) continue;
      try {
        // Expired/rotated credentials can revoke only their own session. They never
        // authorize another API operation or mint new credentials through this path.
        const verified = this.jwtService.verify<JwtPayload>(token, { secret: this.configService.getOrThrow<string>(secret), ignoreExpiration: true });
        if (verified.sub && verified.sid) { payload = verified; break; }
      } catch { /* Try the other supplied credential. */ }
    }
    if (!payload?.sid) throw new UnauthorizedException("Valid logout credentials required");
    const session = await this.prisma.db.authSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub) throw new UnauthorizedException("Invalid session");
    await this.logout(payload.sid);
  }

  async me(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitize(user);
  }

  private async buildAuthPayload(user: User) {
    const sessionId = randomUUID();
    const tokens = this.issueTokens(user.id, user.role, sessionId);
    await this.prisma.db.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.refreshExpiresAt(tokens.refreshToken),
      },
    });
    return { user: this.sanitize(user), ...tokens };
  }

  private sanitize(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded,
      profileCompleteness: user.profileCompleteness,
    };
  }

  private issueTokens(userId: string, role: string | null, sessionId: string) {
    const accessPayload: JwtPayload = { sub: userId, role, sid: sessionId, tid: randomUUID() };
    const refreshPayload: JwtPayload = { sub: userId, role, sid: sessionId, tid: randomUUID() };
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: (this.configService.get<string>("JWT_ACCESS_EXPIRES_IN") ??
        "15m") as JwtSignOptions["expiresIn"],
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: (this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ??
        "7d") as JwtSignOptions["expiresIn"],
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshExpiresAt(refreshToken: string) {
    const payload = this.jwtService.decode<JwtPayload>(refreshToken);
    if (typeof payload?.exp !== "number") throw new Error("Refresh token expiry is required");
    return new Date(payload.exp * 1000);
  }
}

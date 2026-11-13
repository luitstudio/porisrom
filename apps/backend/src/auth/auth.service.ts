import { createHash, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import type { User } from "@porisrom/database";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import type { LoginDto } from "./dto/login.dto";
import type { SignupDto } from "./dto/signup.dto";
import type { GoogleAuthDto, GoogleLinkDto, GoogleSignupIntentDto } from "./dto/google-auth.dto";
import type { CurrentUserPayload } from "./decorators/current-user.decorator";
import { CURRENT_PRIVACY_POLICY_VERSION, CURRENT_TERMS_VERSION } from "./legal-consent";

export interface JwtPayload {
  sub: string;
  role: string | null;
  sid?: string;
  tid?: string;
  exp?: number;
}

type GoogleSignupIntentPayload = {
  purpose: "google-signup";
  role: "freelancer" | "client";
  termsVersion: string;
  privacyPolicyVersion: string;
};

type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async signup(dto: SignupDto) {
    if (!dto.acceptedTerms) {
      throw new ForbiddenException("Terms and Privacy Policy acceptance is required");
    }
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
        ...this.consentData(),
      },
    });

    return this.buildAuthPayload(user);
  }

  async createGoogleSignupIntent(dto: GoogleSignupIntentDto) {
    if (!dto.acceptedTerms) {
      throw new ForbiddenException("Terms and Privacy Policy acceptance is required");
    }

    return {
      signupIntent: this.jwtService.sign<GoogleSignupIntentPayload>(
        {
          purpose: "google-signup",
          role: dto.role,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        },
        {
          secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
          expiresIn: "10m",
        },
      ),
    };
  }

  async googleAuthenticate(dto: GoogleAuthDto) {
    const identity = await this.verifyGoogleIdentity(dto.idToken);
    const existingIdentity = await this.prisma.db.externalIdentity.findUnique({
      where: { provider_providerSubject: { provider: "google", providerSubject: identity.subject } },
      include: { user: true },
    });
    if (existingIdentity) {
      if (existingIdentity.user.status !== "active") {
        throw new ForbiddenException("Account is not active");
      }
      return this.buildAuthPayload(existingIdentity.user);
    }

    const existingUser = await this.prisma.db.user.findUnique({ where: { email: identity.email } });
    if (existingUser) {
      // Verified email is useful for collision detection, never for automatic linking.
      throw new ConflictException("Google account is not linked. Sign in with your password and link it from Settings.");
    }

    const signupIntent = this.verifyGoogleSignupIntent(dto.signupIntent);
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 10);
    try {
      const user = await this.prisma.db.user.create({
        data: {
          name: identity.email.split("@")[0] || "Google user",
          email: identity.email,
          passwordHash,
          role: signupIntent.role,
          termsAcceptedAt: new Date(),
          termsVersion: signupIntent.termsVersion,
          privacyPolicyAcceptedAt: new Date(),
          privacyPolicyVersion: signupIntent.privacyPolicyVersion,
          externalIdentities: {
            create: {
              provider: "google",
              providerSubject: identity.subject,
              emailAtLink: identity.email,
              emailVerifiedAt: new Date(),
            },
          },
        },
      });
      return this.buildAuthPayload(user);
    } catch (error) {
      // A unique collision is intentionally not converted into a session. The
      // caller must retry after authenticating/linking the relevant account.
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException("This Google account or email is already in use");
      }
      throw error;
    }
  }

  async linkGoogleIdentity(userId: string, dto: GoogleAuthDto) {
    const [user, identity] = await Promise.all([
      this.prisma.db.user.findUnique({ where: { id: userId } }),
      this.verifyGoogleIdentity(dto.idToken),
    ]);
    if (!user || user.status !== "active") throw new ForbiddenException("Account is not active");
    if (user.email !== identity.email) {
      throw new ConflictException("Google email must match the signed-in account email");
    }

    const existing = await this.prisma.db.externalIdentity.findUnique({
      where: { provider_providerSubject: { provider: "google", providerSubject: identity.subject } },
    });
    if (existing?.userId === user.id) return { linked: true };
    if (existing) throw new ConflictException("This Google account is linked to another user");

    try {
      await this.prisma.db.externalIdentity.create({
        data: {
          userId: user.id,
          provider: "google",
          providerSubject: identity.subject,
          emailAtLink: identity.email,
          emailVerifiedAt: new Date(),
        },
      });
      return { linked: true };
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException("This Google account is linked to another user");
      throw error;
    }
  }

  async createGoogleLinkIntent(user: CurrentUserPayload) {
    if (!user.sessionId) throw new UnauthorizedException("Missing session");
    const nonce = randomUUID();
    await this.prisma.db.googleLinkIntent.create({
      data: {
        nonce,
        userId: user.userId,
        sessionId: user.sessionId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    return { nonce };
  }

  async linkGoogleIdentityWithIntent(user: CurrentUserPayload, dto: GoogleLinkDto) {
    if (!user.sessionId) throw new UnauthorizedException("Missing session");
    const consumed = await this.prisma.db.googleLinkIntent.updateMany({
      where: {
        nonce: dto.linkIntentNonce,
        userId: user.userId,
        sessionId: user.sessionId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ForbiddenException("Google link request is invalid or expired");
    return this.linkGoogleIdentity(user.userId, dto);
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

  private consentData() {
    const acceptedAt = new Date();
    return {
      termsAcceptedAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyPolicyAcceptedAt: acceptedAt,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    };
  }

  private verifyGoogleSignupIntent(signupIntent?: string): GoogleSignupIntentPayload {
    if (!signupIntent) throw new ForbiddenException("Complete Google signup from the registration form");
    try {
      const payload = this.jwtService.verify<GoogleSignupIntentPayload>(signupIntent, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.purpose !== "google-signup" || !["freelancer", "client"].includes(payload.role) ||
          payload.termsVersion !== CURRENT_TERMS_VERSION || payload.privacyPolicyVersion !== CURRENT_PRIVACY_POLICY_VERSION) {
        throw new Error("invalid signup intent");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired Google signup intent");
    }
  }

  private async verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
    let payload: { sub?: string; email?: string; email_verified?: boolean; iss?: string } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.getOrThrow<string>("GOOGLE_CLIENT_ID"),
      });
      payload = ticket.getPayload();
    } catch {
      // Do not reveal token contents or provider internals in errors or logs.
      throw new UnauthorizedException("Invalid Google identity token");
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true ||
      !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")) {
      throw new UnauthorizedException("Google identity email must be verified");
    }
    return { subject: payload.sub, email: payload.email.trim().toLowerCase() };
  }

  private isUniqueConstraint(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
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

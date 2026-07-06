import bcrypt from "bcryptjs";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";

import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import type { SignupDto } from "./dto/signup.dto";

export interface JwtPayload {
  sub: string;
  role: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    return this.issueTokens(user.id, user.role);
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

    return this.issueTokens(user.id, user.role);
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

    const user = await this.prisma.db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.issueTokens(user.id, user.role);
  }

  async me(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded,
      profileCompleteness: user.profileCompleteness,
    };
  }

  private issueTokens(userId: string, role: string | null) {
    const payload: JwtPayload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: (this.configService.get<string>("JWT_ACCESS_EXPIRES_IN") ??
        "15m") as JwtSignOptions["expiresIn"],
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: (this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ??
        "7d") as JwtSignOptions["expiresIn"],
    });
    return { accessToken, refreshToken };
  }
}

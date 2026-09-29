import { Controller, Get, ServiceUnavailableException, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException({ status: "not_ready" });
    }
  }

  // Dummy route to prove the role guard works end-to-end; remove once a real admin module exists.
  @Get("admin-only")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  adminOnly() {
    return { status: "ok", message: "You are an admin" };
  }
}

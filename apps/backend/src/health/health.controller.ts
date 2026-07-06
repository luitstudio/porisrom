import { Controller, Get, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }

  // Dummy route to prove the role guard works end-to-end; remove once a real admin module exists.
  @Get("admin-only")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  adminOnly() {
    return { status: "ok", message: "You are an admin" };
  }
}

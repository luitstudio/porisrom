import { ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization && !request.cookies?.access_token) return true;
    return super.canActivate(context);
  }
}

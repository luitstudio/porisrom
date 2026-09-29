import { createHash } from "node:crypto";

import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

type RateLimitRule = {
  limit: number;
  windowMs: number;
  key: (request: Request) => string;
};

type AttemptWindow = { count: number; resetAt: number };

const RULES: Record<string, RateLimitRule> = {
  signup: { limit: 5, windowMs: 15 * 60 * 1000, key: accountKey },
  login: { limit: 10, windowMs: 15 * 60 * 1000, key: accountKey },
  refresh: { limit: 30, windowMs: 5 * 60 * 1000, key: refreshKey },
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, AttemptWindow>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const action = routeAction(request);
    const rule = RULES[action];
    if (!rule) return true;

    const now = Date.now();
    this.removeExpiredWindows(now);
    const key = `${action}:${rule.key(request)}`;
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + rule.windowMs });
      return true;
    }

    if (current.count >= rule.limit) {
      throw new HttpException(
        "Too many authentication attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private removeExpiredWindows(now: number) {
    for (const [key, window] of this.attempts) {
      if (window.resetAt <= now) this.attempts.delete(key);
    }
  }
}

function routeAction(request: Request): string {
  const path = request.route?.path;
  return typeof path === "string" ? path.replace(/^\//, "") : "";
}

function accountKey(request: Request): string {
  const email = request.body?.email;
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : request.ip || "unknown";
}

function refreshKey(request: Request): string {
  const token = request.body?.refreshToken ?? request.cookies?.refresh_token;
  if (typeof token !== "string" || !token) return request.ip || "unknown";
  return createHash("sha256").update(token).digest("hex");
}

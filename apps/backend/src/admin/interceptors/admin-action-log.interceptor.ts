import { Observable, tap } from "rxjs";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_ACTION_KEY } from "../decorators/log-admin-action.decorator";

@Injectable()
export class AdminActionLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(ADMIN_ACTION_KEY, context.getHandler());
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const adminId: string | undefined = request.user?.userId;
    const targetUserId: string | undefined = request.params?.id;

    return next.handle().pipe(
      tap(() => {
        if (!adminId) return;
        this.prisma.db.adminActionLog
          .create({ data: { adminId, targetUserId, action } })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("Failed to write admin action log", err);
          });
      }),
    );
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

// Log route templates and status only. Never log URLs, request bodies, headers,
// database error objects, or provider responses which can contain private data.
export function errorSignal(request: Pick<Request, "method" | "route">, status: number) {
  return { event: status >= 500 ? "http_server_error" : "http_request_denied", method: request.method,
    route: typeof request.route?.path === "string" ? request.route.path : "unmatched", status };
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpError");
  catch(error: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const signal = JSON.stringify(errorSignal(request, status));
    if (status >= 500) this.logger.error(signal); else this.logger.warn(signal);
    const body = error instanceof HttpException ? error.getResponse() : { statusCode: 500, message: "Internal server error" };
    response.status(status).json(typeof body === "string" ? { statusCode: status, message: body } : body);
  }
}

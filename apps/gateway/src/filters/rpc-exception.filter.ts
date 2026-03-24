import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";

@Catch(RpcException, Error, Object)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // RpcException instance (thrown directly)
    let payload: { status?: number; message?: string; code?: string } = {};

    if (exception instanceof RpcException) {
      payload = exception.getError() as typeof payload;
    } else if (exception && typeof exception === "object") {
      // Plain TCP error object: { error: { status, message }, message }
      const raw = exception as any;
      payload = raw.error ?? raw;
    }

    const status = typeof payload.status === "number" ? payload.status : 500;
    const message = payload.message ?? "Internal server error";

    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({
        statusCode: status,
        message,
        ...(payload.code ? { code: payload.code } : {}),
      });
  }
}

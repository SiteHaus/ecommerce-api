import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const error = exception.getError() as {
      status?: number;
      message?: string;
      code?: string;
    };

    const status = error.status ?? 500;
    const message = error.message ?? "Internal server error";

    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({
        statusCode: status,
        message,
        ...(error.code ? { code: error.code } : {}),
      });
  }
}

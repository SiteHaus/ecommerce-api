import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseRpcExceptionFilter, RpcException } from "@nestjs/microservices";
import { throwError } from "rxjs";

@Catch(HttpException)
export class HttpToRpcExceptionFilter extends BaseRpcExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const message = typeof res === "string" ? res : ((res as any).message ?? exception.message);
    return throwError(() => new RpcException({ status, message }));
  }
}

import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ValidationError } from 'class-validator';

type ProblemResponse = {
  message?: string;
  error?: string | Record<string, unknown>;
  type?: string;
  detail?: string;
};

const mapValidationErrors = (
  errors: ValidationError[],
  prefix = '',
): Array<{ detail: string; pointer: string }> =>
  errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const details = Object.values(error.constraints ?? {}).map((detail) => ({
      detail,
      pointer: `#/${path.replace(/~/g, '~0').replace(/\./g, '/').replace(/\//g, '~1')}`,
    }));

    return [...details, ...mapValidationErrors(error.children ?? [], path)];
  });

export const toValidationProblemDetails = (errors: ValidationError[]) =>
  new HttpException(
    {
      message: 'Validation Failed',
      error: {
        type: 'validation-error',
        errors: mapValidationErrors(errors),
      },
    },
    HttpStatus.BAD_REQUEST,
  );

@Catch(HttpException)
export class ProblemDetailsFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const body: ProblemResponse =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as ProblemResponse);
    const error = typeof body.error === 'object' ? body.error : undefined;
    const responseBody = {
      ...error,
      type: body.type ?? error?.type ?? 'about:blank',
      title: body.message ?? 'Unexpected Error',
      status,
      ...(body.detail || typeof body.error === 'string'
        ? { detail: body.detail ?? body.error }
        : {}),
    };

    this.httpAdapterHost.httpAdapter.setHeader(
      response,
      'Content-Type',
      'application/problem+json',
    );
    this.httpAdapterHost.httpAdapter.reply(response, responseBody, status);
  }
}

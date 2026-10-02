import { ApiResponse } from '@nestjs/swagger';

/**
 * Documents a non-validation error response in the RFC 9457 problem-details
 * shape `ProblemDetailsFilter` produces (validation errors have their own
 * decorator, `ApiValidationProblemResponse`).
 */
export const ApiProblemResponse = (
  status: number,
  description: string,
  title: string,
) =>
  ApiResponse({
    status,
    description,
    content: {
      'application/problem+json': {
        schema: {
          type: 'object',
          required: ['type', 'title', 'status'],
          properties: {
            type: { type: 'string', example: 'about:blank' },
            title: { type: 'string', example: title },
            status: { type: 'integer', example: status },
            detail: { type: 'string' },
          },
        },
      },
    },
  });

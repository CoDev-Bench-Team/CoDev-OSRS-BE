import type { Type } from '@nestjs/common';
import { getMetadataStorage, type ValidationArguments } from 'class-validator';
import { ApiResponse } from '@nestjs/swagger';

export const ApiExampleResponse = (
  status: number,
  description: string,
  example: unknown,
) =>
  ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        schema: {
          type: Array.isArray(example) ? 'array' : 'object',
          example,
        },
        examples: {
          success: { summary: description, value: example },
        },
      },
    },
  });

const apiProblemResponse = (
  status: number,
  title: string,
  description: string,
  detail: string,
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
            detail: { type: 'string', example: detail },
          },
          example: { type: 'about:blank', title, status, detail },
        },
        examples: {
          problem: {
            summary: description,
            value: { type: 'about:blank', title, status, detail },
          },
        },
      },
    },
  });

export const ApiBadRequestProblemResponse = (detail = 'Bad Request') =>
  apiProblemResponse(
    400,
    detail,
    'Invalid request data or parameters.',
    'Bad Request',
  );

export const ApiUnauthorizedProblemResponse = (detail = 'Unauthorized') =>
  apiProblemResponse(
    401,
    detail,
    'Authentication is required.',
    'Unauthorized',
  );

export const ApiForbiddenProblemResponse = (
  detail = 'Insufficient permissions.',
) =>
  apiProblemResponse(
    403,
    detail,
    'The operation is not permitted.',
    'Forbidden',
  );

export const ApiNotFoundProblemResponse = (resource: string) =>
  apiProblemResponse(
    404,
    `${resource} with ID '42' could not be found.`,
    `The requested ${resource} does not exist.`,
    'Not Found',
  );

export const ApiConflictProblemResponse = (detail: string) =>
  apiProblemResponse(
    409,
    detail,
    'The request conflicts with current resource state.',
    'Conflict',
  );

const problemDetailsSchema = {
  type: 'object',
  required: ['type', 'title', 'status'],
  properties: {
    type: { type: 'string', example: 'validation-error' },
    title: { type: 'string', example: 'Validation Failed' },
    status: { type: 'integer', example: 400 },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['detail', 'pointer'],
        properties: {
          detail: { type: 'string' },
          pointer: { type: 'string', example: '#/name' },
        },
      },
    },
    detail: { type: 'string', example: 'The request is invalid.' },
  },
};

type ValidationMetadataLike = {
  propertyName: string;
  constraints: any[];
  message: string | ((args: ValidationArguments) => string);
};

const formatConstraint = (constraint: unknown) => {
  if (Array.isArray(constraint)) {
    return constraint.join(', ');
  }

  return String(constraint);
};

const formatValidationMessage = (
  metadata: ValidationMetadataLike,
  bodyType: Type<unknown>,
) => {
  const args: ValidationArguments = {
    targetName: bodyType.name,
    property: metadata.propertyName,
    object: {},
    value: undefined,
    constraints: metadata.constraints,
  };

  const message =
    typeof metadata.message === 'function'
      ? metadata.message(args)
      : metadata.message;

  if (!message) {
    return `${metadata.propertyName} is invalid`;
  }

  return message
    .replace('$property', metadata.propertyName)
    .replace(/\$constraint(\d+)/g, (_match: string, index: string) =>
      formatConstraint(metadata.constraints[Number(index) - 1]),
    );
};

const createValidationErrors = (bodyType: Type<unknown>) => {
  const metadata = getMetadataStorage().getTargetValidationMetadatas(
    bodyType,
    '',
    false,
    false,
  );

  return metadata.map((validation) => ({
    detail: formatValidationMessage(validation, bodyType),
    pointer: `#/${validation.propertyName.replace(/~/g, '~0').replace(/\//g, '~1')}`,
  }));
};

/**
 * Documents the 400 response. `additionalProblems` adds examples for 400s a
 * handler throws after validation passes (business rules, such as
 * insufficient stock): those have no `errors` array, just a `title` naming
 * the problem (given here as `detail`).
 */
export const ApiValidationProblemResponse = (
  bodyType?: Type<unknown>,
  additionalProblems: Record<string, { summary: string; detail: string }> = {},
) =>
  ApiResponse({
    status: 400,
    description: 'The request contains invalid data.',
    content: {
      'application/problem+json': {
        schema: problemDetailsSchema,
        examples: {
          validationError: {
            summary: 'Validation errors with JSON Pointers',
            value: {
              type: 'validation-error',
              title: 'Validation Failed',
              status: 400,
              errors: bodyType ? createValidationErrors(bodyType) : [],
            },
          },
          ...Object.fromEntries(
            Object.entries(additionalProblems).map(([name, problem]) => [
              name,
              {
                summary: problem.summary,
                value: {
                  type: 'about:blank',
                  title: problem.detail,
                  status: 400,
                  detail: 'Bad Request',
                },
              },
            ]),
          ),
        },
      },
    },
  });

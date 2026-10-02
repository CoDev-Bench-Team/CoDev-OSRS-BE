import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { RequestStatus } from '../entities/request.entity.js';

export enum RequestSortOrder {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  EMPLOYEE_NAME_ASC = 'employee_name_asc',
}

@ApiSchema({
  description:
    'Pagination, filtering, and sorting options for the request queue. Filters can be combined; partial text filters match any contained text.',
})
export class PaginatedRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'One-based page number to retrieve; values start at 1.',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum number of requests to return on this page.',
    example: 10,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Return requests in exactly this workflow status.',
    enum: RequestStatus,
    example: RequestStatus.PENDING_APPROVAL,
  })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by any substring of the human-readable request ID.',
    example: 'REQ-2026-14',
  })
  @IsOptional()
  @IsString()
  displayId?: string;

  @ApiPropertyOptional({
    description:
      "Filter by a substring of the requester's first name, last name, or email address.",
    example: 'ada@example.com',
  })
  @IsOptional()
  @IsString()
  requester?: string;

  @ApiPropertyOptional({
    description: 'Return only requests submitted by this user ID.',
    example: 42,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requesterId?: number;

  @ApiPropertyOptional({
    description: 'Filter by a substring of any requested catalog asset name.',
    example: 'Laptop',
  })
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional({
    description:
      'Sort order: by submission date (newest/oldest first) or by employee name (A-Z).',
    enum: RequestSortOrder,
    default: RequestSortOrder.NEWEST,
  })
  @IsOptional()
  @IsEnum(RequestSortOrder)
  sort?: RequestSortOrder = RequestSortOrder.NEWEST;
}

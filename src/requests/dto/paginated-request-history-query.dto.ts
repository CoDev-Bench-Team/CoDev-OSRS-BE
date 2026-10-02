import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { RequestStatus } from '../entities/request.entity.js';
import { PaginatedRequestsQueryDto } from './paginated-requests-query.dto.js';

/** The statuses a request is resolved in: shown on the History page. */
export const RESOLVED_STATUSES = [
  RequestStatus.COMPLETED,
  RequestStatus.REJECTED,
  RequestStatus.CANCELLED,
] as const;

/**
 * Query for the admin History (FR-016a): the same search, filters and paging
 * as the Requests Queue, limited to resolved requests. The date sorts
 * (newest / oldest) use the date the request was resolved.
 */
export class PaginatedRequestHistoryQueryDto extends OmitType(
  PaginatedRequestsQueryDto,
  ['status'] as const,
) {
  @ApiPropertyOptional({
    description: 'Filter to one resolved status. Omit for all three.',
    enum: RESOLVED_STATUSES,
  })
  @IsOptional()
  @IsIn(RESOLVED_STATUSES as readonly RequestStatus[], {
    message: `status must be one of: ${RESOLVED_STATUSES.join(', ')}`,
  })
  status?: RequestStatus;
}

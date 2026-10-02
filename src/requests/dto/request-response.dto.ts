import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Request } from '../entities/request.entity.js';
import { RequestAsset } from '../entities/request-asset.entity.js';

// Swagger-only shapes for what the requests endpoints actually return. The
// service decorates each line item with `availableStock` at read time (see
// `RequestsService.attachAvailableStock()`), which the entity schema alone
// can't describe.

export class RequestLineResponseDto extends OmitType(RequestAsset, [
  'request',
] as const) {
  @ApiProperty({
    description:
      "The asset's current available stock, for showing alongside the line while reviewing.",
    example: 12,
  })
  availableStock: number;
}

/** A unit the request holds, for the Accountability Form's list. */
export class RequestUnitResponseDto {
  @ApiProperty({ example: 212 })
  id: number;

  @ApiProperty({ description: 'The asset (catalog item) this unit is of.', example: 1 })
  assetId: number;

  @ApiProperty({
    description: 'The unit\'s serial number, shown on the Accountability Form.',
    example: 'CODEV-LAPTOP-0212',
    nullable: true,
    type: String,
  })
  serialNumber: string | null;

  @ApiProperty({
    description: 'Reserved until the request is received, then Assigned.',
    enum: ['Reserved', 'Assigned'],
    example: 'Assigned',
  })
  status: string;
}

export class RequestResponseDto extends OmitType(Request, ['items'] as const) {
  @ApiProperty({ type: [RequestLineResponseDto] })
  items: RequestLineResponseDto[];

  @ApiPropertyOptional({
    description:
      'The units the request holds, one per requested quantity. Returned by GET /requests/:id and the status-change endpoints, not by the lists.',
    type: [RequestUnitResponseDto],
  })
  units?: RequestUnitResponseDto[];
}

export class PaginatedRequestsResponseDto {
  @ApiProperty({ type: [RequestResponseDto] })
  data: RequestResponseDto[];

  @ApiProperty({ description: 'Requests matching the filters, across all pages.', example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

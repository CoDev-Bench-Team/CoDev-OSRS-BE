import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  description:
    'Reusable pagination query fields. Both values default when omitted and must be positive integers.',
})
export class PaginationQueryDto {
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
    description: 'Maximum number of records to return on this page.',
    example: 10,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

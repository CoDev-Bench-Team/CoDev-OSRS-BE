import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetCategory } from '../../assets/entities/asset.entity.js';
import { InventoryItemStatus } from '../entities/inventory-item.entity.js';
import { PaginationQueryDto } from '../../assets/dto/pagination-query.dto.js';

@ApiSchema({
  description:
    'Pagination and optional filters for searching individual physical inventory units by linked asset, lifecycle status, or assigned user.',
})
export class PaginatedInventoryItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Filter by the asset's item name, model, or category name (partial match).",
    example: 'Latitude',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter units by the linked asset category.',
    enum: AssetCategory,
  })
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;

  @ApiPropertyOptional({
    description: 'Return only units in this inventory lifecycle status.',
    enum: InventoryItemStatus,
  })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @ApiPropertyOptional({
    description: 'Return only units assigned to this user ID.',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number;
}

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetCategory } from '../entities/asset.entity.js';

// @IsOptional() skips validation for both undefined and null, so fields that
// may be cleared use it, while fields backed by NOT NULL columns use
// @ValidateIf to skip only undefined and reject null.
const isDefined = (_: object, value: unknown) => value !== undefined;

@ApiSchema({
  description:
    'Partial catalog-asset update. Omit properties to keep existing values; send null only for nullable specifications to clear them. Stock quantity is derived from inventory and is not editable here.',
})
export class UpdateAssetDto {
  @ApiPropertyOptional({
    description:
      'Base64-encoded image data for the item, optionally prefixed with a data URI scheme (e.g. "data:image/png;base64,..."). Pass null to clear it.',
    example:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageBase64?: string | null;

  @ApiPropertyOptional({
    description: 'Replacement catalog display name for this type of equipment.',
    example: 'External Keyboard',
  })
  @ValidateIf(isDefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'The category the item belongs to.',
    enum: AssetCategory,
    example: AssetCategory.LAPTOP,
  })
  @ValidateIf(isDefined)
  @IsEnum(AssetCategory)
  category?: AssetCategory;

  @ApiPropertyOptional({
    description: 'Replacement manufacturer and model designation.',
    example: 'Logitech MX Keys',
  })
  @ValidateIf(isDefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  model?: string;

  @ApiPropertyOptional({
    description: 'A free-form description of the item. Pass null to clear it.',
    example: 'Business laptop with a 14-inch display.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'The RAM spec of the item. Pass null to clear it.',
    example: '16GB',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ram?: string | null;

  @ApiPropertyOptional({
    description: 'The processor spec of the item. Pass null to clear it.',
    example: 'Intel Core i7-1355U',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  processor?: string | null;

  @ApiPropertyOptional({
    description: 'The graphics spec of the item. Pass null to clear it.',
    example: 'Intel Iris Xe Graphics',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  graphics?: string | null;

  @ApiPropertyOptional({
    description:
      'The operating system spec of the item. Pass null to clear it.',
    example: 'Windows 11 Pro',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  operatingSystem?: string | null;

  @ApiPropertyOptional({
    description: 'The storage spec of the item. Pass null to clear it.',
    example: '512GB SSD',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storage?: string | null;

  @ApiPropertyOptional({
    description:
      'Replacement low-stock threshold for available inventory units. Must be zero or greater.',
    example: 5,
    minimum: 0,
  })
  @ValidateIf(isDefined)
  @IsInt()
  @Min(0)
  lowQtyAlert?: number;
}

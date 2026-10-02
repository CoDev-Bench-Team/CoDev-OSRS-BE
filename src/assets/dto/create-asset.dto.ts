import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetCategory } from '../entities/asset.entity.js';

@ApiSchema({
  description:
    'Catalog definition for a type of office equipment. This creates descriptive asset metadata only; physical inventory units are registered separately.',
})
export class CreateAssetDto {
  @ApiPropertyOptional({
    description:
      'Base64-encoded image data for the item, optionally prefixed with a data URI scheme (e.g. "data:image/png;base64,...").',
    example:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiProperty({
    description: 'The catalog display name for this type of equipment.',
    example: 'External Keyboard',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'The category the item belongs to.',
    enum: AssetCategory,
    example: AssetCategory.LAPTOP,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(AssetCategory)
  category: AssetCategory;

  @ApiProperty({
    description: 'The manufacturer and model designation for the equipment.',
    example: 'Logitech MX Keys',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  model: string;

  @ApiPropertyOptional({
    description: 'Optional summary of the equipment and its intended use.',
    example: 'Business laptop with a 14-inch display.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string;

  @ApiPropertyOptional({
    description: 'The RAM spec of the item.',
    example: '16GB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ram?: string;

  @ApiPropertyOptional({
    description: 'The processor spec of the item.',
    example: 'Intel Core i7-1355U',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  processor?: string;

  @ApiPropertyOptional({
    description: 'The graphics spec of the item.',
    example: 'Intel Iris Xe Graphics',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  graphics?: string;

  @ApiPropertyOptional({
    description: 'The operating system spec of the item.',
    example: 'Windows 11 Pro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  operatingSystem?: string;

  @ApiPropertyOptional({
    description: 'The storage spec of the item.',
    example: '512GB SSD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storage?: string;

  @ApiPropertyOptional({
    description:
      'Available-unit count at or below which the asset is considered low in stock. Must be zero or greater; defaults to 5.',
    example: 5,
    default: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowQtyAlert?: number = 5;
}

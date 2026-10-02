import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetLocation } from '../../assets/entities/asset.entity.js';

@ApiSchema({
  description:
    'Optional serial and BitLocker identifiers for one unit in a bulk inventory creation request.',
})
class InventoryItemUnitDto {
  @ApiPropertyOptional({
    description: 'The serial number of this inventory item.',
    example: 'PF3ABCXY',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  serialNumber?: string;

  @ApiPropertyOptional({
    description: "This inventory item's BitLocker identifier.",
    example: '12345678-90AB-CDEF-1234-567890ABCDEF',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bitlockerIdentifier?: string;

  @ApiPropertyOptional({
    description: "This inventory item's BitLocker recovery key/PIN.",
    example: '123456-654321-123456-654321-123456-654321-123456-654321',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recoveryPin?: string;
}

@ApiSchema({
  description:
    'Bulk registration for 1 to 100 physical units of the same existing catalog asset. Location and purchase information are shared; serial and BitLocker identifiers are supplied per unit.',
})
export class CreateInventoryItemBatchDto {
  @ApiProperty({
    description: 'The ID of the catalog asset these inventory items belong to.',
    example: 1,
  })
  @IsDefined()
  @IsInt()
  assetId: number;

  @ApiProperty({
    description: 'Office where every unit in this batch is initially stored.',
    enum: AssetLocation,
    example: AssetLocation.CEBU,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(AssetLocation)
  location: AssetLocation;

  @ApiPropertyOptional({
    description:
      'Purchase price shared by each unit, with up to two decimal places; must be non-negative.',
    example: 1299.99,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'The supplier every inventory item was purchased from.',
    example: 'Amazon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;

  @ApiPropertyOptional({
    description:
      'Purchase date and time shared by the batch, in ISO 8601 format.',
    example: '2026-01-15T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  purchasedAt?: Date;

  @ApiProperty({
    description:
      'Per-unit identifiers. One inventory record is created for each entry; the array must contain between 1 and 100 entries, and provided serial numbers must be unique.',
    type: [InventoryItemUnitDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InventoryItemUnitDto)
  units: InventoryItemUnitDto[];
}

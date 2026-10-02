import {
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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetLocation } from '../../assets/entities/asset.entity.js';

@ApiSchema({
  description:
    'Registration details for one physical inventory unit linked to an existing catalog asset. Unassigned units start Available; units created with an assignee start Assigned.',
})
export class CreateInventoryItemDto {
  @ApiProperty({
    description: 'The ID of the catalog asset this inventory item belongs to.',
    example: 1,
  })
  @IsDefined()
  @IsInt()
  assetId: number;

  @ApiPropertyOptional({
    description:
      'Purchase price in the system currency, with up to two decimal places; must be non-negative.',
    example: 1299.99,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'The supplier this inventory item was purchased from.',
    example: 'Amazon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;

  @ApiPropertyOptional({
    description: 'Purchase date and time in ISO 8601 format.',
    example: '2026-01-15T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  purchasedAt?: Date;

  @ApiPropertyOptional({
    description:
      'Manufacturer serial number. If supplied, it must be unique across active inventory units.',
    example: 'PF3ABCXY',
    maxLength: 255,
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

  @ApiPropertyOptional({
    description:
      'Optional integer user ID to assign this unit to at creation; assigning it sets status to Assigned.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @ApiProperty({
    description: 'Office where this physical unit is currently stored.',
    enum: AssetLocation,
    example: AssetLocation.CEBU,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(AssetLocation)
  location: AssetLocation;

  @ApiPropertyOptional({
    description: 'Free-form notes about this inventory item.',
    example: 'Minor scratch on the lid.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string;

  @ApiPropertyOptional({
    description: 'The URL of an attachment for this inventory item.',
    example: 'https://example.com/receipts/1234.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string;
}

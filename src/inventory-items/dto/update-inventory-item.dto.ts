import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { AssetLocation } from '../../assets/entities/asset.entity.js';
import { InventoryItemStatus } from '../entities/inventory-item.entity.js';

const isDefined = (_: object, value: unknown) => value !== undefined;

@ApiSchema({
  description:
    'Partial update for one physical inventory unit. Omit fields to retain their values; nullable fields accept null to clear them. Setting assignedToId to null unassigns the unit and returns it to Available status.',
})
export class UpdateInventoryItemDto {
  @ApiPropertyOptional({
    description:
      'Move this unit to another catalog asset using its integer ID.',
    example: 1,
  })
  @ValidateIf(isDefined)
  @IsInt()
  assetId?: number;

  @ApiPropertyOptional({
    description:
      'Purchase price in the system currency, with up to two decimal places. Pass null to clear it.',
    example: 1299.99,
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({
    description:
      'The supplier this inventory item was purchased from. Pass null to clear it.',
    example: 'Amazon',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string | null;

  @ApiPropertyOptional({
    description:
      'Purchase date and time in ISO 8601 format. Pass null to clear it.',
    example: '2026-01-15T00:00:00.000Z',
    nullable: true,
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  purchasedAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'Manufacturer serial number; active inventory serial numbers must be unique. Pass null to clear it.',
    example: 'PF3ABCXY',
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  serialNumber?: string | null;

  @ApiPropertyOptional({
    description:
      "This inventory item's BitLocker identifier. Pass null to clear it.",
    example: '12345678-90AB-CDEF-1234-567890ABCDEF',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bitlockerIdentifier?: string | null;

  @ApiPropertyOptional({
    description:
      "This inventory item's BitLocker recovery key/PIN. Pass null to clear it.",
    example: '123456-654321-123456-654321-123456-654321-123456-654321',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recoveryPin?: string | null;

  @ApiPropertyOptional({
    description:
      'Integer user ID to assign this unit to. Pass null to unassign it.',
    example: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  assignedToId?: number | null;

  @ApiPropertyOptional({
    description: 'Office where this physical unit is currently stored.',
    enum: AssetLocation,
    example: AssetLocation.CEBU,
  })
  @ValidateIf(isDefined)
  @IsEnum(AssetLocation)
  location?: AssetLocation;

  @ApiPropertyOptional({
    description:
      'Free-form notes about this inventory item. Pass null to clear it.',
    example: 'Minor scratch on the lid.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'The URL of an attachment for this inventory item. Pass null to clear it.',
    example: 'https://example.com/receipts/1234.png',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Inventory lifecycle status. Assignment changes also update this value automatically.',
    enum: InventoryItemStatus,
    example: InventoryItemStatus.AVAILABLE,
  })
  @ValidateIf(isDefined)
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class RemoveInventoryItemDto {
  @ApiProperty({
    description: 'Why the unit is being removed from inventory. Stored with the removed unit.',
    example: 'Screen damaged beyond repair.',
  })
  @IsString()
  @Matches(/\S/, { message: 'reason is required when removing an inventory item.' })
  @MaxLength(500)
  reason: string;
}

import { IsDefined, IsInt, IsPositive, Min } from 'class-validator';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  description:
    'One requested catalog asset and the number of physical units needed. The asset must exist and have enough available stock when the request is submitted.',
})
export class CreateRequestItemDto {
  @ApiProperty({
    description: 'Positive numeric ID of the catalog asset being requested.',
    example: 1,
    minimum: 1,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  assetId: number;

  @ApiProperty({
    description:
      'Number of physical units requested; must be a positive integer.',
    example: 1,
    minimum: 1,
  })
  @IsDefined()
  @IsInt()
  @Min(1)
  quantity: number;
}

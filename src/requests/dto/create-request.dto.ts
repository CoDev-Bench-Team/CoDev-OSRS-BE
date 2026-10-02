import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { CreateRequestItemDto } from './create-request-item.dto.js';

@ApiSchema({
  description:
    'Submission payload for an equipment request. At least one item is required; each catalog asset may appear once, and requested quantities are reserved from available stock during submission.',
})
export class CreateRequestDto {
  @ApiPropertyOptional({
    description:
      "Optional explanation of the request's business purpose; maximum 500 characters.",
    example: 'temporary project setup',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @ApiProperty({
    description:
      'Requested catalog assets and quantities. Include at least one line and do not repeat an asset.',
    type: [CreateRequestItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRequestItemDto)
  items: CreateRequestItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** The Accountability Form the requester signs to complete a received
 * request (BEN-143). */
export class SignRequestDto {
  @ApiProperty({
    description:
      'The "I have read and agree to the above" checkbox. Must be true.',
    example: true,
  })
  @Equals(true, {
    message: 'You must agree to the accountability conditions to sign.',
  })
  agreed: boolean;

  @ApiProperty({
    description: 'The full name the requester types to sign.',
    example: 'Eve Santos',
  })
  @IsString()
  @Matches(/\S/, { message: 'fullName is required to sign the form.' })
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({
    description: 'The form\'s optional "Other Notes".',
    example: 'Monitor box had a dent; the monitor itself is fine.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

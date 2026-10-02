import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CancelRequestDto {
  @ApiProperty({
    description: 'Why the request is being cancelled. Shown to the requester.',
    example: 'No longer needed — the team found a spare monitor.',
  })
  @IsString()
  @Matches(/\S/, { message: 'reason is required when cancelling a request.' })
  @MaxLength(500)
  reason: string;
}

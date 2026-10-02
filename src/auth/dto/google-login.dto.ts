import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

@ApiSchema({
  description:
    'Request body for exchanging a Google Sign-In ID token for an application session. The token must belong to a verified account in the configured Google Workspace.',
})
export class GoogleLoginDto {
  @ApiProperty({
    description:
      'The Google OAuth ID token credential returned by Google Sign-In. This is an ID token, not an OAuth access token.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6I...',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  credential: string;
}

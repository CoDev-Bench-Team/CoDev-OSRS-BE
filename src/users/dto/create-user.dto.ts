import {
  IsAlpha,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { UserLocation, UserRole } from '../entities/user.entity.js';

@ApiSchema({
  description:
    'Fields required for an administrator to create a user account. Email must be unique; role and office location provide authorization and assignment context.',
})
export class CreateUserDto {
  @ApiProperty({
    description:
      "The user's unique email address, used for contact and account lookup.",
    example: 'ada@example.com',
    format: 'email',
  })
  @IsDefined()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "The user's first name. Letters only; maximum 50 characters.",
    example: 'Ada',
    maxLength: 50,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsAlpha()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: "The user's last name. Letters only; maximum 50 characters.",
    example: 'Lovelace',
    maxLength: 50,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsAlpha()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: "An absolute URL for the user's Google profile image.",
    example: 'https://example.com/avatar.png',
    maxLength: 2048,
    format: 'uri',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl: string;

  @ApiProperty({
    description:
      'The role assigned to the new user; admins can manage accounts and review requests.',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    description: "The user's primary office location.",
    enum: UserLocation,
    example: UserLocation.CEBU,
  })
  @IsDefined()
  @IsNotEmpty()
  @IsEnum(UserLocation)
  location: UserLocation;
}

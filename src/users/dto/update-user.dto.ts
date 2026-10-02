import {
  IsAlpha,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { UserLocation, UserRole } from '../entities/user.entity.js';

@ApiSchema({
  description:
    'Partial account update. Omit fields to leave them unchanged; email and Google subject cannot be changed through this DTO.',
})
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Replacement first name. Letters only; maximum 50 characters.',
    example: 'Ada',
    maxLength: 50,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsAlpha()
  @MaxLength(50)
  firstName: string;

  @ApiPropertyOptional({
    description: 'Replacement last name. Letters only; maximum 50 characters.',
    example: 'Lovelace',
    maxLength: 50,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsAlpha()
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({
    description:
      "Replacement absolute URL for the user's Google profile image.",
    example: 'https://example.com/avatar.png',
    maxLength: 2048,
    format: 'uri',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl: string;

  @ApiPropertyOptional({
    description: 'Replacement authorization role for the user.',
    enum: UserRole,
    example: UserRole.EMPLOYEE,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Replacement primary office location for the user.',
    enum: UserLocation,
    example: UserLocation.CEBU,
  })
  @IsOptional()
  @IsNotEmpty()
  @IsEnum(UserLocation)
  location: UserLocation;
}

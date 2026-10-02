import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import {
  ApiBadRequestProblemResponse,
  ApiConflictProblemResponse,
  ApiExampleResponse,
  ApiForbiddenProblemResponse,
  ApiNotFoundProblemResponse,
  ApiUnauthorizedProblemResponse,
  ApiValidationProblemResponse,
} from '../common/api-validation-problem-response.decorator.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'List user accounts.',
    description:
      'Returns user accounts with their role and office location. This administrative directory includes fields used for assignment and request review. Admin session required.',
  })
  @ApiExampleResponse(200, 'All user accounts.', [
    {
      id: 7,
      googleSubject: 'google-subject-123',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      avatarUrl: 'https://example.com/ada.png',
      role: 'employee',
      location: 'Cebu',
      createdAt: '2026-01-10T08:00:00.000Z',
      updatedAt: null,
      deletedAt: null,
    },
  ])
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @Roles('admin')
  @Get()
  list() {
    return this.usersService.list();
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Get one user account by ID.',
    description:
      'Returns the account profile, role, and office location for the supplied numeric user ID. Admin session required.',
  })
  @ApiParam({
    name: 'id',
    description: 'The numeric user identifier.',
    type: Number,
  })
  @ApiExampleResponse(200, 'The requested user account.', {
    id: 7,
    googleSubject: 'google-subject-123',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
    role: 'employee',
    location: 'Cebu',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: null,
    deletedAt: null,
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('User')
  @Roles('admin')
  @Get(':id')
  find(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.find(id);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Create a user account.',
    description:
      'Creates an account with the supplied identity, role, and office details. Email addresses must be unique. Admin session required.',
  })
  @ApiValidationProblemResponse(CreateUserDto)
  @ApiExampleResponse(201, 'The created user account.', {
    id: 8,
    email: 'grace@example.com',
    firstName: 'Grace',
    lastName: 'Hopper',
    avatarUrl: 'https://example.com/grace.png',
    role: 'admin',
    location: 'Makati',
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: null,
    deletedAt: null,
  })
  @ApiConflictProblemResponse(
    "User with email 'grace@example.com' already exists.",
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @Roles('admin')
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Update a user profile, role, or office location.',
    description:
      'Partially updates the selected account. Only supplied fields are changed. Admin session required.',
  })
  @ApiValidationProblemResponse(UpdateUserDto, {
    invalidId: {
      summary: 'The route ID is not an integer.',
      detail: 'Validation failed (numeric string is expected)',
    },
  })
  @ApiParam({
    name: 'id',
    description: 'The numeric user identifier.',
    type: Number,
  })
  @ApiExampleResponse(200, 'The updated user account.', {
    id: 7,
    googleSubject: 'google-subject-123',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
    role: 'admin',
    location: 'Cebu',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
    deletedAt: null,
  })
  @ApiBadRequestProblemResponse(
    'Validation failed (numeric string is expected)',
  )
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('User')
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @ApiCookieAuth('session')
  @ApiOperation({
    summary: 'Delete a user account.',
    description:
      'Removes the selected user account and returns the deleted account fields. Admin session required.',
  })
  @ApiParam({
    name: 'id',
    description: 'The numeric user identifier.',
    type: Number,
  })
  @ApiExampleResponse(200, 'The deleted user account.', {
    id: 7,
    googleSubject: 'google-subject-123',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
    role: 'employee',
    location: 'Cebu',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: null,
    deletedAt: null,
  })
  @ApiBadRequestProblemResponse('The user ID must be an integer.')
  @ApiUnauthorizedProblemResponse()
  @ApiForbiddenProblemResponse()
  @ApiNotFoundProblemResponse('User')
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.delete(id);
  }
}

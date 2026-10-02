import { Controller, Get, Post, Body, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Public } from './public.decorator.js';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiExampleResponse,
  ApiForbiddenProblemResponse,
  ApiUnauthorizedProblemResponse,
  ApiValidationProblemResponse,
} from '../common/api-validation-problem-response.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @ApiOperation({
    summary: 'Sign in or provision an account using Google Workspace.',
    description:
      'Verifies the Google Sign-In ID token, requires a verified account in the configured company Workspace, creates or refreshes the matching user account, and sets an HTTP-only session cookie valid for eight hours. Returns the authenticated user. This endpoint is public.',
  })
  @ApiValidationProblemResponse(GoogleLoginDto)
  @ApiExampleResponse(201, 'The authenticated user; a session cookie is set.', {
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
  @ApiUnauthorizedProblemResponse(
    'The Google ID token is invalid or is missing identity information.',
  )
  @ApiForbiddenProblemResponse(
    'The Google account is unverified, outside the configured Workspace, or disabled.',
  )
  @Post('google')
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) response: any,
  ) {
    const user = await this.authService.authenticateGoogle(dto.credential);

    const token = await this.jwt.signAsync({ sub: user.id });

    const production = this.config.get<string>('NODE_ENV') === 'production';
    response.cookie('session', token, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
      path: '/',
    });

    return user;
  }

  @ApiOperation({
    summary: 'Sign out by clearing the session cookie.',
    description:
      'Clears the session cookie in the response and returns a success indicator. Public so clients can clear stale sessions without a valid token.',
  })
  @ApiExampleResponse(201, 'The session cookie was cleared.', { success: true })
  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: any) {
    response.clearCookie('session', { httpOnly: true, path: '/' });
    return { success: true };
  }

  @ApiOperation({
    summary: 'Get the user associated with the current session.',
    description:
      'Validates the session cookie and returns the corresponding user account. Requires a valid, non-expired session cookie.',
  })
  @ApiCookieAuth('session')
  @ApiExampleResponse(200, 'The authenticated user account.', {
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
  @ApiUnauthorizedProblemResponse()
  @Get('me')
  me(@Req() request: any) {
    return request.user;
  }
}

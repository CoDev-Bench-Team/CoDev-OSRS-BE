import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../users/entities/user.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '../mailer/mailer.service.js';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly mailerService: MailerService
  ) {}

  async authenticateGoogle(credential: string): Promise<User> {
    const googleClientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const allowedDomain = this.config
      .getOrThrow<string>('GOOGLE_ALLOWED_DOMAIN')
      .toLowerCase();

    let ticket;

    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google credential.');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Invalid Google credential.');
    }

    const {
      sub,
      email,
      email_verified: emailVerified,
      hd,
      given_name: givenName,
      family_name: familyName,
      picture,
    } = payload;

    if (!sub || !email) {
      throw new UnauthorizedException(
        'Google account is missing identity information.',
      );
    }

    if (!emailVerified) {
      throw new ForbiddenException(
        'Google email address has not been verified.',
      );
    }

    if (!hd || hd.toLowerCase() !== allowedDomain) {
      throw new ForbiddenException(
        'Only company Google workspace accounts may log in.',
      );
    }

    const normalizedEmail = email.toLowerCase();
    if (!normalizedEmail.endsWith(`@${allowedDomain}`)) {
      throw new ForbiddenException(
        'Email address is not part of the company domain.',
      );
    }

    const adminEmails = this.config
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((adminEmail) => adminEmail.trim().toLowerCase())
      .filter(Boolean);
    const isAdminEmail = adminEmails.includes(normalizedEmail);
    const roleForEmail = isAdminEmail ? UserRole.ADMIN : UserRole.EMPLOYEE;

    let user = await this.usersRepository.findOne({
      where: {
        googleSubject: sub,
      },
    });

    if (user) {
      if (user.deletedAt) {
        throw new ForbiddenException('This user has been deleted.');
      }

      user.email = normalizedEmail;
      user.firstName = givenName ?? user.firstName;
      user.lastName = familyName ?? user.lastName;
      user.avatarUrl = picture ?? user.avatarUrl;
      user.role = roleForEmail;
      return this.usersRepository.save(user);
    }

    user = await this.usersRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (user) {
      if (user.deletedAt) {
        throw new ForbiddenException('This user has been deleted.');
      }

      if (user.googleSubject && user.googleSubject !== sub) {
        throw new ForbiddenException(
          'This Google account is already linked to another user.',
        );
      }

      user.googleSubject = sub;
      user.firstName = givenName ?? user.firstName;
      user.lastName = familyName ?? user.lastName;
      user.avatarUrl = picture ?? user.avatarUrl;
      user.role = roleForEmail;
      return this.usersRepository.save(user);
    }

    const newUser = this.usersRepository.create({
      googleSubject: sub,
      email: normalizedEmail,
      firstName: givenName ?? '',
      lastName: familyName ?? '',
      avatarUrl: picture,
      role: roleForEmail,
      createdAt: new Date(),
    });

    await this.mailerService.sendWelcomeEmail(newUser);

    return this.usersRepository.save(newUser);
  }
}

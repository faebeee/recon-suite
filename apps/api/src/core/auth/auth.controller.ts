import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Public, SessionService, SignInService } from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import { loginInputSchema, type AuthStatus } from '@recon/shared';
import type { IncomingMessage } from 'node:http';
import type { z } from 'zod';
import { ADMIN } from './admin-user.js';
import { AuthSettings } from './auth-settings.service.js';
import { isLoopback, peerAddress } from './request-source.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly settings: AuthSettings,
    private readonly sessions: SessionService,
    private readonly signInService: SignInService,
  ) {}

  /** Public so the UI can decide between the app, the login form and the setup hint. */
  @Public()
  @Get('status')
  async status(@Req() req: IncomingMessage): Promise<AuthStatus> {
    if (!this.settings.passwordConfigured) {
      return { mode: 'open', authenticated: isLoopback(peerAddress(req)) };
    }
    const bearer = /^Bearer\s+(\S+)$/i.exec(
      req.headers.authorization ?? '',
    )?.[1];
    if (bearer && this.settings.verifyApiToken(bearer)) {
      return { mode: 'password', authenticated: true };
    }
    const session = await this.sessions.validate(this.sessions.tokenFrom(req));
    return {
      mode: 'password',
      authenticated: !!session && session.userId === ADMIN.id,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  // Tighter than the global limit: scrypt is slow on purpose, guessing should be too.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body({ schema: loginInputSchema }) body: z.output<typeof loginInputSchema>,
  ): Promise<AuthStatus> {
    if (!this.settings.passwordConfigured) {
      throw new BadRequestException(
        'No password is configured. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH on the API.',
      );
    }
    if (!(await this.settings.verifyPassword(body.password))) {
      throw new UnauthorizedException('Wrong password');
    }
    await this.signInService.signIn(ADMIN.id, { method: 'password' });
    return { mode: 'password', authenticated: true };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(): Promise<void> {
    await this.signInService.signOut();
  }
}

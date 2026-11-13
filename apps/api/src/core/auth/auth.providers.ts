import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  AuthenticationProvider,
  AuthenticationRegistry,
  SessionCookieProvider,
  type AuthenticationResult,
  type SessionRecord,
} from '@nestjs/authentication';
import { ADMIN, type AdminUser } from './admin-user.js';
import { AuthSettings } from './auth-settings.service.js';
import { isLoopback, peerAddress } from './request-source.js';

/** Browser sessions created by POST /api/auth/login. */
@Injectable()
export class SessionAuth extends SessionCookieProvider<AdminUser> {
  constructor(
    registry: AuthenticationRegistry,
    private readonly settings: AuthSettings,
  ) {
    super();
    registry.registerProvider(this, { order: 0 });
  }

  protected validate(session: SessionRecord): AdminUser | null {
    return this.settings.passwordConfigured && session.userId === ADMIN.id
      ? ADMIN
      : null;
  }
}

/** `Authorization: Bearer <API_TOKEN>` for scripts and CI. */
@Injectable()
export class ApiTokenAuth extends AuthenticationProvider<AdminUser, undefined> {
  constructor(
    registry: AuthenticationRegistry,
    private readonly settings: AuthSettings,
  ) {
    super();
    registry.registerProvider(this, { order: 1 });
  }

  authenticate(
    context: ExecutionContext,
  ): AuthenticationResult<AdminUser, undefined> | null {
    const header = this.header(context, 'authorization');
    const token = /^Bearer\s+(\S+)$/i.exec(header ?? '')?.[1];
    return token && this.settings.verifyApiToken(token)
      ? { user: ADMIN }
      : null;
  }

  challenge(): string {
    return 'Bearer realm="recon-suite"';
  }
}

/**
 * Without a configured password, requests from this machine are let in (local single-user
 * use, as before authentication existed). Anything else is refused until a password is set.
 */
@Injectable()
export class LocalOpenAuth extends AuthenticationProvider<
  AdminUser,
  undefined
> {
  constructor(
    registry: AuthenticationRegistry,
    private readonly settings: AuthSettings,
  ) {
    super();
    registry.registerProvider(this, { order: 2 });
  }

  authenticate(
    context: ExecutionContext,
  ): AuthenticationResult<AdminUser, undefined> | null {
    if (this.settings.passwordConfigured) return null;
    const req = context
      .switchToHttp()
      .getRequest<{ socket?: { remoteAddress?: string } }>();
    return isLoopback(peerAddress(req)) ? { user: ADMIN } : null;
  }
}

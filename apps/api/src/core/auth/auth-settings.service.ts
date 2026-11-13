import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordHasher } from '@nestjs/authentication';
import type { Env } from '../../config/env.js';

/**
 * Login configuration from the environment.
 * - ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD enables password login.
 * - Without either, the API is "open" but only for requests from its own machine.
 * - API_TOKEN enables `Authorization: Bearer <token>` for scripts.
 */
@Injectable()
export class AuthSettings implements OnModuleInit {
  private readonly logger = new Logger('Auth');
  private passwordHash?: string;
  private readonly apiTokenDigest?: Buffer;
  readonly hasher = new PasswordHasher();

  constructor(private readonly config: ConfigService<Env, true>) {
    const token = config.get('API_TOKEN', { infer: true });
    if (token) this.apiTokenDigest = digest(token);
  }

  async onModuleInit() {
    const hash = this.config.get('ADMIN_PASSWORD_HASH', { infer: true });
    const plain = this.config.get('ADMIN_PASSWORD', { infer: true });
    if (hash) this.passwordHash = hash;
    else if (plain) this.passwordHash = await this.hasher.hash(plain);
    if (this.passwordHash) {
      this.logger.log('Password login enabled.');
    } else {
      this.logger.warn(
        'No ADMIN_PASSWORD(_HASH) set: the API only accepts requests from this machine (loopback).',
      );
    }
  }

  get passwordConfigured(): boolean {
    return !!this.passwordHash;
  }

  verifyPassword(password: string): Promise<boolean> {
    return this.hasher.verify(password, this.passwordHash);
  }

  /** Constant-time comparison of a presented bearer token with API_TOKEN. */
  verifyApiToken(token: string): boolean {
    if (!this.apiTokenDigest) return false;
    return timingSafeEqual(digest(token), this.apiTokenDigest);
  }
}

const digest = (s: string) => createHash('sha256').update(s).digest();

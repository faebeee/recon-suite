/** Recon Suite has a single operator account. */
export interface AdminUser {
  id: 'admin';
  name: string;
}

export const ADMIN: AdminUser = { id: 'admin', name: 'admin' };

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AdminUser;
  }
}

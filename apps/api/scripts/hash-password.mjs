// Prints an ADMIN_PASSWORD_HASH for a password read from stdin (not argv, so it stays out
// of shell history). Usage: pnpm --filter @recon/api hash-password
import { createInterface } from 'node:readline/promises';
import { PasswordHasher } from '@nestjs/authentication';

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = (await rl.question('Password (min. 12 characters): ')).trim();
rl.close();
if (password.length < 12) {
  console.error('Password too short.');
  process.exit(1);
}
console.log(await new PasswordHasher().hash(password));

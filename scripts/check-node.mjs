// Fails early with a clear message when Node.js is too old for the API (it needs the built-in
// node:sqlite module). Run before `npm run dev` / `npm start`; keep it free of newer syntax
// and APIs so it also runs on the old versions it is meant to reject.
import { readFileSync } from 'fs';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const required = Number(
  String(pkg.engines.node)
    .replace(/[^0-9.]/g, '')
    .split('.')[0],
);
const current = Number(process.versions.node.split('.')[0]);

if (current < required) {
  console.error(
    [
      `Recon Suite needs Node.js ${required} or newer; this is Node.js ${process.versions.node}`,
      `(${process.execPath}). The API uses the built-in node:sqlite module, which older`,
      'versions lack ("No such built-in module: node:sqlite").',
      '',
      'Install a current Node.js, e.g. with nvm (https://github.com/nvm-sh/nvm):',
      '  nvm install        # reads .nvmrc',
      '  nvm use',
      'Distribution packages (apt install nodejs) are usually too old.',
      'Then reinstall dependencies: rm -rf node_modules && npm ci',
    ].join('\n'),
  );
  process.exit(1);
}

import { defineConfig, loadEnv } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // WEB_PORT / API_PORT configure `npm run dev` and `npm start` for both apps at once.
  // A fixed WEB_PORT must not drift to the next free port: the API only trusts that origin.
  const webPort = env.WEB_PORT ? Number(env.WEB_PORT) : 5173;
  const apiTarget = env.API_PORT
    ? `http://localhost:${env.API_PORT}`
    : (env.API_PROXY_TARGET ?? 'http://localhost:4000');

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
    ],
    server: {
      port: webPort,
      strictPort: !!env.WEB_PORT,
      proxy: {
        '/api': apiTarget,
      },
    },
  };
});

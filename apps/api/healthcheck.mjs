// Container health check (compose.yaml): exit 0 when the API answers /api/health.
// A script instead of `node -e "..."` because podman-compose mangles quoted health check
// commands (seen with 1.3.0 on Debian / Raspberry Pi OS).
const port = process.env.PORT ?? '4000';
try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(2500),
  });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}

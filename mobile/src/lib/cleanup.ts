/**
 * The server handles 24-hr cleanup automatically via node-cron.
 * This module exposes a helper to format the remaining TTL for display.
 */
export function formatTTL(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

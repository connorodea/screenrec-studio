/**
 * Loads + validates the environment the share-loop backend needs, failing fast
 * with EVERY missing variable named at once (not one-at-a-time) so a misconfigured
 * deploy is obvious. Pure — takes an env object so it's unit-testable; the route
 * layer calls `loadConfig(process.env)` once and assembles the handler/client
 * dependencies from the result. Var names match the connorodea environment
 * (CLOUDFLARE_CO_*). See ../../docs/share-loop-spec.md.
 */

export interface AppConfig {
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  streamCustomerSubdomain: string;
  streamWebhookSecret: string;
  deepgramApiKey: string;
  anthropicApiKey: string;
  databaseUrl: string;
  watchBaseUrl: string;
}

const REQUIRED: Record<keyof AppConfig, string> = {
  cloudflareAccountId: "CLOUDFLARE_CO_ACCOUNT_ID",
  cloudflareApiToken: "CLOUDFLARE_CO_API_TOKEN",
  streamCustomerSubdomain: "CF_STREAM_CUSTOMER_SUBDOMAIN",
  streamWebhookSecret: "CF_STREAM_WEBHOOK_SECRET",
  deepgramApiKey: "DEEPGRAM_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  databaseUrl: "DATABASE_URL",
  watchBaseUrl: "WATCH_BASE_URL",
};

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const out = {} as Record<keyof AppConfig, string>;
  const missing: string[] = [];

  for (const key of Object.keys(REQUIRED) as (keyof AppConfig)[]) {
    const envName = REQUIRED[key];
    const value = env[envName]?.trim();
    if (!value) {
      missing.push(envName);
      continue;
    }
    out[key] = value;
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  // Trailing slash would double up in `${watchBaseUrl}/v/${slug}`.
  out.watchBaseUrl = out.watchBaseUrl.replace(/\/+$/, "");

  return out;
}

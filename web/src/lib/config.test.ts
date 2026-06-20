import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const fullEnv: Record<string, string | undefined> = {
  CLOUDFLARE_CO_ACCOUNT_ID: "acct",
  CLOUDFLARE_CO_API_TOKEN: "token",
  CF_STREAM_CUSTOMER_SUBDOMAIN: "customer-x.cloudflarestream.com",
  CF_STREAM_WEBHOOK_SECRET: "whsec",
  DEEPGRAM_API_KEY: "dg",
  ANTHROPIC_API_KEY: "an",
  DATABASE_URL: "postgres://u:p@host/db",
  WATCH_BASE_URL: "https://share.example.com",
};

describe("loadConfig", () => {
  it("returns a typed config when every required var is present", () => {
    expect(loadConfig(fullEnv)).toEqual({
      cloudflareAccountId: "acct",
      cloudflareApiToken: "token",
      streamCustomerSubdomain: "customer-x.cloudflarestream.com",
      streamWebhookSecret: "whsec",
      deepgramApiKey: "dg",
      anthropicApiKey: "an",
      databaseUrl: "postgres://u:p@host/db",
      watchBaseUrl: "https://share.example.com",
    });
  });

  it("lists ALL missing vars in the error, not just the first", () => {
    const env = { ...fullEnv };
    delete env.DEEPGRAM_API_KEY;
    delete env.ANTHROPIC_API_KEY;

    let err: Error | undefined;
    try {
      loadConfig(env);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain("DEEPGRAM_API_KEY");
    expect(err!.message).toContain("ANTHROPIC_API_KEY");
  });

  it("treats a blank / whitespace value as missing", () => {
    expect(() => loadConfig({ ...fullEnv, WATCH_BASE_URL: "   " })).toThrow(/WATCH_BASE_URL/);
  });

  it("strips a trailing slash from watchBaseUrl so /v/:slug joins cleanly", () => {
    const config = loadConfig({ ...fullEnv, WATCH_BASE_URL: "https://share.example.com/" });
    expect(config.watchBaseUrl).toBe("https://share.example.com");
  });
});

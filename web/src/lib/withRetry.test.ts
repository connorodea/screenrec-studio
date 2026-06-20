import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./withRetry";

describe("withRetry", () => {
  it("returns immediately on the first success without sleeping", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const op = vi.fn(async () => "ok");

    const result = await withRetry(op, { sleep });
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries transient failures with exponential backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleeps.push(ms);
    });
    let calls = 0;
    const op = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "recovered";
    });

    const result = await withRetry(op, { sleep, baseDelayMs: 200 });
    expect(result).toBe("recovered");
    expect(op).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([200, 400]);
  });

  it("gives up after the retry budget and throws the last error", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const op = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(withRetry(op, { sleep, retries: 2, baseDelayMs: 100 })).rejects.toThrow("boom");
    expect(op).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry when isRetryable returns false", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const op = vi.fn(async () => {
      throw new Error("fatal");
    });

    await expect(
      withRetry(op, { sleep, isRetryable: () => false })
    ).rejects.toThrow("fatal");
    expect(op).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

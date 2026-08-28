import { describe, expect, it } from "vitest";

import { readWebhookSecret, verifyWebhookSecret } from "./webhook-security";

describe("webhook security", () => {
  it("accepts only the configured secret", async () => {
    await expect(verifyWebhookSecret("correct", "correct")).resolves.toBe(true);
    await expect(verifyWebhookSecret("incorrect", "correct")).resolves.toBe(false);
    await expect(verifyWebhookSecret(null, "correct")).resolves.toBe(false);
  });

  it("reads custom and bearer headers", () => {
    expect(readWebhookSecret(new Headers({ "x-axionn-webhook-secret": "custom" }))).toBe("custom");
    expect(readWebhookSecret(new Headers({ authorization: "Bearer token" }))).toBe("token");
    expect(readWebhookSecret(new Headers())).toBeNull();
  });
});

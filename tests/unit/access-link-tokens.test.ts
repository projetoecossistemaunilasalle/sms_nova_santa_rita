import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ACCESS_LINK_TOKEN_LENGTH,
  generateAccessLinkToken,
  hashToken,
  isValidAccessTokenFormat,
} from "@/server/security/tokens";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

describe("generateAccessLinkToken", () => {
  it("produces exactly 43 unpadded base64url characters", () => {
    for (let i = 0; i < 100; i += 1) {
      const token = generateAccessLinkToken();
      expect(token).toHaveLength(ACCESS_LINK_TOKEN_LENGTH);
      expect(token).toHaveLength(43);
      expect(BASE64URL_PATTERN.test(token)).toBe(true);
      // No standard base64 padding or URL-unsafe characters.
      expect(token).not.toContain("=");
      expect(token).not.toContain("+");
      expect(token).not.toContain("/");
    }
  });

  it("encodes 32 bytes of entropy (256 bits) per token", () => {
    // 43 base64url chars without padding carry exactly 256 bits, so a fixed
    // length of 43 with a valid alphabet implies the 32-byte input size.
    for (let i = 0; i < 20; i += 1) {
      const token = generateAccessLinkToken();
      const bytes = Buffer.from(token, "base64url");
      expect(bytes).toHaveLength(32);
    }
  });

  it("draws unique tokens across many generations", () => {
    const draws = 1000;
    const tokens = new Set<string>();
    for (let i = 0; i < draws; i += 1) {
      tokens.add(generateAccessLinkToken());
    }
    expect(tokens.size).toBe(draws);
  });
});

describe("hashToken", () => {
  it("returns a 64-character lowercase hex digest", () => {
    const digest = hashToken(generateAccessLinkToken());
    expect(digest).toHaveLength(64);
    expect(LOWERCASE_HEX_64.test(digest)).toBe(true);
  });

  it("is deterministic for the same raw token", () => {
    const token = generateAccessLinkToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("matches an independent SHA-256 computation", () => {
    const token = "definitely-a-token-value-1234567890abcdefghij";
    const expected = createHash("sha256").update(token, "utf8").digest("hex");
    expect(hashToken(token)).toBe(expected);
  });

  it("produces distinct digests for distinct tokens", () => {
    const first = generateAccessLinkToken();
    const second = generateAccessLinkToken();
    expect(first).not.toBe(second);
    expect(hashToken(first)).not.toBe(hashToken(second));
  });
});

describe("isValidAccessTokenFormat", () => {
  it("accepts generated tokens", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isValidAccessTokenFormat(generateAccessLinkToken())).toBe(true);
    }
  });

  it("rejects the empty string", () => {
    expect(isValidAccessTokenFormat("")).toBe(false);
  });

  it("rejects tokens that are too short", () => {
    expect(isValidAccessTokenFormat("a".repeat(42))).toBe(false);
    expect(isValidAccessTokenFormat("a".repeat(1))).toBe(false);
  });

  it("rejects tokens that are too long", () => {
    expect(isValidAccessTokenFormat("a".repeat(44))).toBe(false);
    expect(isValidAccessTokenFormat("a".repeat(64))).toBe(false);
  });

  it("rejects characters outside the base64url alphabet", () => {
    // Correct length, wrong charset: padding, URL-unsafe symbols, spaces.
    expect(isValidAccessTokenFormat(`${"+".repeat(43)}`)).toBe(false);
    expect(isValidAccessTokenFormat(`${"/".repeat(43)}`)).toBe(false);
    expect(isValidAccessTokenFormat(`=${"a".repeat(42)}`)).toBe(false);
    expect(isValidAccessTokenFormat(`${"a".repeat(42)}=`)).toBe(false);
    expect(
      isValidAccessTokenFormat(`${"a".repeat(21)} ${"a".repeat(21)}`),
    ).toBe(false);
  });

  it("rejects percent-encoded strings", () => {
    expect(isValidAccessTokenFormat(`${"a".repeat(42)}%3D`)).toBe(false);
    expect(isValidAccessTokenFormat(`${"a".repeat(41)}%2Faa`)).toBe(false);
    expect(
      isValidAccessTokenFormat(encodeURIComponent("+/+/+/+/+/+/+/+/+/+/+/")),
    ).toBe(false);
  });
});

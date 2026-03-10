import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("fs");

const CACHE_FILE = path.join(os.homedir(), ".glop", "update-check.json");

describe("checkForUpdate", () => {
  let checkForUpdate: typeof import("./update-check.js").checkForUpdate;

  const originalEnv = { ...process.env };
  const originalStderr = process.stderr.isTTY;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CI;
    Object.defineProperty(process.stderr, "isTTY", { value: true, writable: true, configurable: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ version: "1.0.0" })
    );
    const mod = await import("./update-check.js");
    checkForUpdate = mod.checkForUpdate;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stderr, "isTTY", { value: originalStderr, writable: true, configurable: true });
  });

  it("prints notification when newer version is available", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await checkForUpdate("0.5.0");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("0.5.0 → 1.0.0")
    );
  });

  it("does not print when current version matches latest", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      Response.json({ version: "0.5.0" })
    );

    await checkForUpdate("0.5.0");

    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not print when current version is ahead of latest", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      Response.json({ version: "0.4.0" })
    );

    await checkForUpdate("0.5.0");

    expect(console.error).not.toHaveBeenCalled();
  });

  it("uses cached version when cache is fresh", async () => {
    const cache = {
      last_check: Date.now() - 1000, // 1 second ago
      latest_version: "2.0.0",
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cache));

    await checkForUpdate("0.5.0");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("0.5.0 → 2.0.0")
    );
  });

  it("refetches when cache is stale", async () => {
    const cache = {
      last_check: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      latest_version: "0.9.0",
    };
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === CACHE_FILE
    );
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cache));

    await checkForUpdate("0.5.0");

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("0.5.0 → 1.0.0")
    );
  });

  it("skips check when CI env var is set", async () => {
    process.env.CI = "true";

    await checkForUpdate("0.5.0");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("skips check when stderr is not a TTY", async () => {
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, writable: true, configurable: true });

    await checkForUpdate("0.5.0");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("silently handles network errors", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network error"));

    await expect(checkForUpdate("0.5.0")).resolves.toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("silently handles corrupt cache", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("not json{{{");

    await checkForUpdate("0.5.0");

    // Should fall through to fetch
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("0.5.0 → 1.0.0")
    );
  });

  it("writes cache after fetching from npm", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await checkForUpdate("0.5.0");

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      CACHE_FILE,
      expect.stringContaining('"latest_version":"1.0.0"')
    );
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable } from "stream";

vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../lib/git.js", () => ({
  getRepoKey: vi.fn(),
  getBranch: vi.fn(),
}));

const { loadConfig } = await import("../lib/config.js");
const { getRepoKey, getBranch } = await import("../lib/git.js");
const { hookCommand } = await import("./hook.js");

function withMockStdin(data: string, fn: () => Promise<void>) {
  const originalStdin = process.stdin;
  const readable = new Readable();
  readable.push(data);
  readable.push(null);
  Object.defineProperty(process, "stdin", {
    value: readable,
    writable: true,
    configurable: true,
  });
  return fn().finally(() => {
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
  });
}

describe("__hook command", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing when not authenticated", async () => {
    vi.mocked(loadConfig).mockReturnValue(null);
    await withMockStdin(
      JSON.stringify({ hook_event_name: "PostToolUse" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends enriched payload to server", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("feat/cool");

    await withMockStdin(
      JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/v1/ingest/hook");
    expect(opts.headers.Authorization).toBe("Bearer glop_test");

    const body = JSON.parse(opts.body);
    expect(body.repo_key).toBe("acme/app");
    expect(body.branch).toBe("feat/cool");
    expect(body.machine_id).toBe("machine-1");
    expect(body.tool_name).toBe("Edit");
  });

  it("prints connection message on SessionStart success", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    await withMockStdin(
      JSON.stringify({ hook_event_name: "SessionStart" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(console.log).toHaveBeenCalledWith(
      "glop: connected to http://localhost:3000"
    );
  });

  it("prints auth failure on SessionStart 401", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_bad",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });

    await withMockStdin(
      JSON.stringify({ hook_event_name: "SessionStart" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(console.log).toHaveBeenCalledWith(
      "glop: API key expired or invalid — run `glop auth` to re-authenticate"
    );
  });

  it("prints unreachable on SessionStart network error", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    await withMockStdin(
      JSON.stringify({ hook_event_name: "SessionStart" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(console.log).toHaveBeenCalledWith(
      "glop: server unreachable at http://localhost:3000"
    );
  });

  it("stays silent on non-SessionStart errors", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    await withMockStdin(
      JSON.stringify({ hook_event_name: "PostToolUse" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(console.log).not.toHaveBeenCalled();
  });

  it("falls back to cwd when git remote is unavailable", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue(null);
    vi.mocked(getBranch).mockReturnValue("main");

    await withMockStdin(
      JSON.stringify({
        hook_event_name: "PostToolUse",
        cwd: "/Users/test/my-project",
      }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.repo_key).toBe("/Users/test/my-project");
  });
});

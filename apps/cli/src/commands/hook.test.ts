import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable } from "stream";

vi.mock("fs", () => ({
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
}));
vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../lib/git.js", () => ({
  getRepoKey: vi.fn(),
  getBranch: vi.fn(),
  getGitUserName: vi.fn(),
  getGitUserEmail: vi.fn(),
}));

const { openSync, readSync, closeSync } = await import("fs");
const { loadConfig } = await import("../lib/config.js");
const { getRepoKey, getBranch, getGitUserName, getGitUserEmail } = await import("../lib/git.js");
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

  it("extracts slug from transcript file and includes it in payload", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    const content = '{"type":"init","slug":"woolly-scribbling-kay"}\n{"type":"message"}\n';
    vi.mocked(openSync).mockReturnValue(42);
    vi.mocked(readSync).mockImplementation((fd, buf: Buffer) => {
      const bytes = Buffer.from(content);
      bytes.copy(buf);
      return bytes.length;
    });
    vi.mocked(closeSync).mockReturnValue(undefined);

    await withMockStdin(
      JSON.stringify({
        hook_event_name: "SessionStart",
        transcript_path: "/tmp/transcript.jsonl",
      }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(openSync).toHaveBeenCalledWith("/tmp/transcript.jsonl", "r");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.slug).toBe("woolly-scribbling-kay");
  });

  it("extracts slug that appears after several non-slug lines", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    // Real-world layout: slug appears on line 6 after snapshots and user messages
    const lines = [
      '{"type":"file-history-snapshot","messageId":"aaa"}',
      '{"type":"progress","sessionId":"ses-1"}',
      '{"type":"user","sessionId":"ses-1"}',
      '{"type":"user","sessionId":"ses-1"}',
      '{"type":"user","sessionId":"ses-1"}',
      '{"type":"file-history-snapshot","messageId":"bbb"}',
      '{"type":"user","sessionId":"ses-1","slug":"late-arriving-slug"}',
      '{"type":"assistant","sessionId":"ses-1","slug":"late-arriving-slug"}',
    ];
    const content = lines.join("\n") + "\n";
    vi.mocked(openSync).mockReturnValue(42);
    vi.mocked(readSync).mockImplementation((fd, buf: Buffer) => {
      const bytes = Buffer.from(content);
      bytes.copy(buf);
      return bytes.length;
    });
    vi.mocked(closeSync).mockReturnValue(undefined);

    await withMockStdin(
      JSON.stringify({
        hook_event_name: "SessionStart",
        transcript_path: "/tmp/transcript.jsonl",
      }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.slug).toBe("late-arriving-slug");
  });

  it("skips slug when transcript file is missing", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    vi.mocked(openSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    await withMockStdin(
      JSON.stringify({
        hook_event_name: "PostToolUse",
        transcript_path: "/tmp/nonexistent.jsonl",
      }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.slug).toBeUndefined();
  });

  it("skips slug when transcript has no slug field", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");
    const content = '{"type":"init"}\n{"type":"message"}\n';
    vi.mocked(openSync).mockReturnValue(42);
    vi.mocked(readSync).mockImplementation((fd, buf: Buffer) => {
      const bytes = Buffer.from(content);
      bytes.copy(buf);
      return bytes.length;
    });
    vi.mocked(closeSync).mockReturnValue(undefined);

    await withMockStdin(
      JSON.stringify({
        hook_event_name: "PostToolUse",
        transcript_path: "/tmp/transcript.jsonl",
      }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.slug).toBeUndefined();
  });

  it("skips slug when no transcript_path in payload", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoKey).mockReturnValue("acme/app");
    vi.mocked(getBranch).mockReturnValue("main");

    await withMockStdin(
      JSON.stringify({ hook_event_name: "PostToolUse" }),
      () => hookCommand.parseAsync([], { from: "user" })
    );

    expect(openSync).not.toHaveBeenCalled();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.slug).toBeUndefined();
  });
});

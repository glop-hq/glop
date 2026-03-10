import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
  loadGlobalConfig: vi.fn(),
  saveGlobalConfig: vi.fn(),
  loadRepoConfig: vi.fn(() => null),
  saveRepoConfig: vi.fn(),
  getMachineId: vi.fn(() => "machine-123"),
}));
vi.mock("../lib/auth-flow.js", () => ({
  openBrowser: vi.fn(),
  findOpenPort: vi.fn(() => Promise.resolve(12345)),
  waitForCallback: vi.fn(),
}));
vi.mock("../lib/select.js", () => ({
  interactiveSelect: vi.fn(),
}));
vi.mock("../lib/git.js", () => ({
  getRepoRoot: vi.fn(() => null),
}));

const { loadConfig, loadGlobalConfig, saveGlobalConfig, loadRepoConfig, saveRepoConfig } = await import("../lib/config.js");
const { waitForCallback } = await import("../lib/auth-flow.js");
const { interactiveSelect } = await import("../lib/select.js");
const { getRepoRoot } = await import("../lib/git.js");
const { workspaceCommand } = await import("./workspace.js");

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("workspace command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Default to TTY
    Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
    // Default: no repo
    vi.mocked(getRepoRoot).mockReturnValue(null);
    vi.mocked(loadRepoConfig).mockReturnValue(null);
  });

  it("exits when not authenticated", async () => {
    vi.mocked(loadConfig).mockReturnValue(null);
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      "Not authenticated. Run `glop auth` first."
    );
    mockExit.mockRestore();
  });

  it("exits on 401 API response", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "API key is invalid. Run `glop auth` to re-authenticate."
    );
    mockExit.mockRestore();
  });

  it("shows single workspace without picker", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [{ id: "ws-1", name: "Acme Corp", slug: "acme" }],
      }),
    });
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.log).toHaveBeenCalledWith("  Workspace: Acme Corp");
    expect(interactiveSelect).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("prints current workspace in non-TTY mode", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.log).toHaveBeenCalledWith("Acme Corp");
    expect(interactiveSelect).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("shows already on workspace when selecting current", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(0); // select first (current)
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.log).toHaveBeenCalledWith("\n  Already on Acme Corp.");
    mockExit.mockRestore();
  });

  it("cancels on Esc (null from selector)", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(null);
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.log).toHaveBeenCalledWith("\n  Cancelled.");
    expect(saveGlobalConfig).not.toHaveBeenCalled();
    expect(saveRepoConfig).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("skips auth and writes repo binding when credentials exist", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    vi.mocked(loadGlobalConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      machine_id: "machine-1",
      developer_name: "Test",
      default_workspace: "ws-1",
      workspaces: {
        "ws-1": { api_key: "glop_abc", developer_id: "dev-1", workspace_name: "Acme Corp", workspace_slug: "acme" },
        "ws-2": { api_key: "glop_xyz", developer_id: "dev-2", workspace_name: "Side Project", workspace_slug: "side" },
      },
    });
    vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(1); // select ws-2
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    // Should write repo binding without triggering auth
    expect(saveRepoConfig).toHaveBeenCalledWith({ workspace_id: "ws-2" });
    expect(waitForCallback).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("\n  Switched to Side Project!");
    mockExit.mockRestore();
  });

  it("skips auth and updates global default when credentials exist but no repo", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    const globalConfig = {
      server_url: "http://localhost:3000",
      machine_id: "machine-1",
      developer_name: "Test",
      default_workspace: "ws-1",
      workspaces: {
        "ws-1": { api_key: "glop_abc", developer_id: "dev-1", workspace_name: "Acme Corp", workspace_slug: "acme" },
        "ws-2": { api_key: "glop_xyz", developer_id: "dev-2", workspace_name: "Side Project", workspace_slug: "side" },
      },
    };
    vi.mocked(loadGlobalConfig).mockReturnValue(globalConfig);
    vi.mocked(getRepoRoot).mockReturnValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(1);
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(saveRepoConfig).not.toHaveBeenCalled();
    expect(saveGlobalConfig).toHaveBeenCalledWith(
      expect.objectContaining({ default_workspace: "ws-2" })
    );
    expect(waitForCallback).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("triggers auth flow when no credentials exist for selected workspace", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
      workspace_id: "ws-1",
    });
    vi.mocked(loadGlobalConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      machine_id: "machine-1",
      developer_name: "Test",
      default_workspace: "ws-1",
      workspaces: {
        "ws-1": { api_key: "glop_abc", developer_id: "dev-1", workspace_name: "Acme Corp", workspace_slug: "acme" },
      },
    });
    vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(1); // select ws-2 (no creds)
    vi.mocked(waitForCallback).mockResolvedValue({
      api_key: "glop_new_key",
      developer_id: "dev-2",
      developer_name: "Test",
      workspace_id: "ws-2",
      workspace_name: "Side Project",
      workspace_slug: "side",
    });
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      workspaceCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    // Should trigger auth and save credentials globally + repo binding
    expect(waitForCallback).toHaveBeenCalled();
    expect(saveGlobalConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaces: expect.objectContaining({
          "ws-2": expect.objectContaining({ api_key: "glop_new_key" }),
        }),
      })
    );
    expect(saveRepoConfig).toHaveBeenCalledWith({ workspace_id: "ws-2" });
    expect(console.log).toHaveBeenCalledWith("\n  Switched to Side Project!");
    mockExit.mockRestore();
  });
});

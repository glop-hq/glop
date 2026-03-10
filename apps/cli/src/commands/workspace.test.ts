import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
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

const { loadConfig, saveConfig } = await import("../lib/config.js");
const { waitForCallback } = await import("../lib/auth-flow.js");
const { interactiveSelect } = await import("../lib/select.js");
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
    expect(saveConfig).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("switches workspace via browser auth flow", async () => {
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
        workspaces: [
          { id: "ws-1", name: "Acme Corp", slug: "acme" },
          { id: "ws-2", name: "Side Project", slug: "side" },
        ],
      }),
    });
    vi.mocked(interactiveSelect).mockResolvedValue(1); // select second
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

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        api_key: "glop_new_key",
        workspace_id: "ws-2",
        workspace_name: "Side Project",
        workspace_slug: "side",
      })
    );
    expect(console.log).toHaveBeenCalledWith("\n  Switched to Side Project!");
    mockExit.mockRestore();
  });
});

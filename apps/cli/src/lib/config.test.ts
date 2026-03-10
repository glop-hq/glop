import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("fs");
vi.mock("./git.js", () => ({
  getRepoRoot: vi.fn(() => null),
}));

describe("config", () => {
  let loadConfig: typeof import("./config.js").loadConfig;
  let loadGlobalConfig: typeof import("./config.js").loadGlobalConfig;
  let saveGlobalConfig: typeof import("./config.js").saveGlobalConfig;
  let loadRepoConfig: typeof import("./config.js").loadRepoConfig;
  let saveRepoConfig: typeof import("./config.js").saveRepoConfig;
  let getMachineId: typeof import("./config.js").getMachineId;
  let getServerUrl: typeof import("./config.js").getServerUrl;
  let getRepoRoot: typeof import("./git.js").getRepoRoot;

  const configDir = path.join(os.homedir(), ".glop");
  const configFile = path.join(configDir, "config.json");
  const machineIdFile = path.join(configDir, "machine_id");

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./config.js");
    loadConfig = mod.loadConfig;
    loadGlobalConfig = mod.loadGlobalConfig;
    saveGlobalConfig = mod.saveGlobalConfig;
    loadRepoConfig = mod.loadRepoConfig;
    saveRepoConfig = mod.saveRepoConfig;
    getMachineId = mod.getMachineId;
    getServerUrl = mod.getServerUrl;
    const gitMod = await import("./git.js");
    getRepoRoot = gitMod.getRepoRoot;
  });

  describe("loadGlobalConfig", () => {
    it("returns null when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadGlobalConfig()).toBeNull();
    });

    it("returns parsed global config when file exists", () => {
      const config = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        default_workspace: "ws-1",
        workspaces: {
          "ws-1": {
            api_key: "glop_test",
            developer_id: "dev-1",
            workspace_name: "Acme",
            workspace_slug: "acme-123",
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));
      expect(loadGlobalConfig()).toEqual(config);
    });

    it("returns null when config file is invalid JSON", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("not json");
      expect(loadGlobalConfig()).toBeNull();
    });
  });

  describe("saveGlobalConfig", () => {
    it("creates config dir and writes config file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const config = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        workspaces: {
          "ws-1": {
            api_key: "glop_test",
            developer_id: "dev-1",
          },
        },
      };
      saveGlobalConfig(config);
      expect(fs.mkdirSync).toHaveBeenCalledWith(configDir, {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(config, null, 2)
      );
    });
  });

  describe("loadRepoConfig", () => {
    it("returns null when not in a git repo", () => {
      vi.mocked(getRepoRoot).mockReturnValue(null);
      expect(loadRepoConfig()).toBeNull();
    });

    it("returns null when repo config does not exist", () => {
      vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadRepoConfig()).toBeNull();
    });

    it("returns parsed repo config when file exists", () => {
      vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ workspace_id: "ws-2" })
      );
      expect(loadRepoConfig()).toEqual({ workspace_id: "ws-2" });
    });
  });

  describe("saveRepoConfig", () => {
    it("throws when not in a git repo", () => {
      vi.mocked(getRepoRoot).mockReturnValue(null);
      expect(() => saveRepoConfig({ workspace_id: "ws-1" })).toThrow(
        "Not in a git repository"
      );
    });

    it("creates .glop dir and writes repo config", () => {
      vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      saveRepoConfig({ workspace_id: "ws-2" });
      expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/repo/.glop", {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/fake/repo/.glop/config.json",
        JSON.stringify({ workspace_id: "ws-2" }, null, 2)
      );
    });
  });

  describe("loadConfig", () => {
    it("returns null when global config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadConfig()).toBeNull();
    });

    it("returns null when global config has no workspaces", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          server_url: "http://localhost:3000",
          machine_id: "machine-1",
          developer_name: "Test",
          workspaces: {},
        })
      );
      expect(loadConfig()).toBeNull();
    });

    it("resolves flat config from default workspace", () => {
      vi.mocked(getRepoRoot).mockReturnValue(null);
      const globalConfig = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        default_workspace: "ws-1",
        workspaces: {
          "ws-1": {
            api_key: "glop_abc",
            developer_id: "dev-1",
            workspace_name: "Acme",
            workspace_slug: "acme-123",
          },
          "ws-2": {
            api_key: "glop_xyz",
            developer_id: "dev-2",
            workspace_name: "Side",
            workspace_slug: "side-456",
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(globalConfig)
      );

      expect(loadConfig()).toEqual({
        server_url: "http://localhost:3000",
        api_key: "glop_abc",
        developer_id: "dev-1",
        developer_name: "Test",
        machine_id: "machine-1",
        workspace_id: "ws-1",
        workspace_name: "Acme",
        workspace_slug: "acme-123",
      });
    });

    it("resolves workspace from per-repo binding over default", () => {
      vi.mocked(getRepoRoot).mockReturnValue("/fake/repo");
      const globalConfig = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        default_workspace: "ws-1",
        workspaces: {
          "ws-1": {
            api_key: "glop_abc",
            developer_id: "dev-1",
            workspace_name: "Acme",
            workspace_slug: "acme-123",
          },
          "ws-2": {
            api_key: "glop_xyz",
            developer_id: "dev-2",
            workspace_name: "Side",
            workspace_slug: "side-456",
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).includes("/fake/repo/.glop/config.json")) {
          return JSON.stringify({ workspace_id: "ws-2" });
        }
        return JSON.stringify(globalConfig);
      });

      expect(loadConfig()).toEqual({
        server_url: "http://localhost:3000",
        api_key: "glop_xyz",
        developer_id: "dev-2",
        developer_name: "Test",
        machine_id: "machine-1",
        workspace_id: "ws-2",
        workspace_name: "Side",
        workspace_slug: "side-456",
      });
    });

    it("falls back to first workspace when no default or binding", () => {
      vi.mocked(getRepoRoot).mockReturnValue(null);
      const globalConfig = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        workspaces: {
          "ws-1": {
            api_key: "glop_abc",
            developer_id: "dev-1",
            workspace_name: "Acme",
            workspace_slug: "acme-123",
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(globalConfig)
      );

      const result = loadConfig();
      expect(result).not.toBeNull();
      expect(result!.workspace_id).toBe("ws-1");
      expect(result!.api_key).toBe("glop_abc");
    });

    it("returns null when resolved workspace is missing from workspaces map", () => {
      vi.mocked(getRepoRoot).mockReturnValue(null);
      const globalConfig = {
        server_url: "http://localhost:3000",
        machine_id: "machine-1",
        developer_name: "Test",
        default_workspace: "ws-gone",
        workspaces: {
          "ws-1": {
            api_key: "glop_abc",
            developer_id: "dev-1",
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify(globalConfig)
      );

      expect(loadConfig()).toBeNull();
    });
  });

  describe("getMachineId", () => {
    it("returns existing machine ID if file exists", () => {
      vi.mocked(fs.existsSync).mockImplementation((p) =>
        String(p) === machineIdFile
      );
      vi.mocked(fs.readFileSync).mockReturnValue("existing-id\n");
      expect(getMachineId()).toBe("existing-id");
    });

    it("generates and saves new machine ID if file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const id = getMachineId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(machineIdFile, id);
    });
  });

  describe("getServerUrl", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns GLOP_SERVER_URL env var if set", () => {
      process.env.GLOP_SERVER_URL = "http://custom:9000";
      expect(getServerUrl()).toBe("http://custom:9000");
    });

    it("returns config server_url if no env var", () => {
      delete process.env.GLOP_SERVER_URL;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          server_url: "http://saved:4000",
          machine_id: "m-1",
          developer_name: "Test",
          default_workspace: "ws-1",
          workspaces: {
            "ws-1": {
              api_key: "glop_test",
              developer_id: "dev-1",
            },
          },
        })
      );
      expect(getServerUrl()).toBe("http://saved:4000");
    });
  });
});

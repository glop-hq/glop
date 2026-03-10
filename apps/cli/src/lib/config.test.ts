import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("fs");

describe("config", () => {
  let loadConfig: typeof import("./config.js").loadConfig;
  let saveConfig: typeof import("./config.js").saveConfig;
  let getMachineId: typeof import("./config.js").getMachineId;
  let getServerUrl: typeof import("./config.js").getServerUrl;

  const configDir = path.join(os.homedir(), ".glop");
  const configFile = path.join(configDir, "config.json");
  const machineIdFile = path.join(configDir, "machine_id");

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh module
    const mod = await import("./config.js");
    loadConfig = mod.loadConfig;
    saveConfig = mod.saveConfig;
    getMachineId = mod.getMachineId;
    getServerUrl = mod.getServerUrl;
  });

  describe("loadConfig", () => {
    it("returns null when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadConfig()).toBeNull();
    });

    it("returns parsed config when file exists", () => {
      const config = {
        server_url: "http://localhost:3000",
        api_key: "glop_test",
        developer_id: "dev-1",
        developer_name: "Test",
        machine_id: "machine-1",
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));
      expect(loadConfig()).toEqual(config);
    });

    it("returns parsed config with optional workspace fields", () => {
      const config = {
        server_url: "http://localhost:3000",
        api_key: "glop_test",
        developer_id: "dev-1",
        developer_name: "Test",
        machine_id: "machine-1",
        workspace_id: "ws-1",
        workspace_name: "Acme Corp",
        workspace_slug: "acme-corp-abc123",
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));
      const loaded = loadConfig();
      expect(loaded).toEqual(config);
      expect(loaded!.workspace_id).toBe("ws-1");
      expect(loaded!.workspace_name).toBe("Acme Corp");
      expect(loaded!.workspace_slug).toBe("acme-corp-abc123");
    });

    it("returns null when config file is invalid JSON", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("not json");
      expect(loadConfig()).toBeNull();
    });
  });

  describe("saveConfig", () => {
    it("creates config dir and writes config file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const config = {
        server_url: "http://localhost:3000",
        api_key: "glop_test",
        developer_id: "dev-1",
        developer_name: "Test",
        machine_id: "machine-1",
      };
      saveConfig(config);
      expect(fs.mkdirSync).toHaveBeenCalledWith(configDir, {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configFile,
        JSON.stringify(config, null, 2)
      );
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
        JSON.stringify({ server_url: "http://saved:4000" })
      );
      expect(getServerUrl()).toBe("http://saved:4000");
    });
  });
});

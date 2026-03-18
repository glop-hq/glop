import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";

vi.mock("fs");
vi.mock("../lib/git.js", () => ({
  getRepoRoot: vi.fn(),
}));

const { getRepoRoot } = await import("../lib/git.js");
const { unlinkCommand } = await import("./unlink.js");

describe("unlink command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("exits when not in a git repo", async () => {
    vi.mocked(getRepoRoot).mockReturnValue(null);
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      unlinkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith("Not in a git repository.");
    mockExit.mockRestore();
  });

  it("prints nothing-to-do when not bound", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await unlinkCommand.parseAsync([], { from: "user" });

    expect(console.log).toHaveBeenCalledWith(
      "This repo is not bound to a workspace. Nothing to do."
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it("removes .glop/config.json and cleans empty directory", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    await unlinkCommand.parseAsync([], { from: "user" });

    expect(fs.unlinkSync).toHaveBeenCalledWith("/mock/repo/.glop/config.json");
    expect(fs.rmdirSync).toHaveBeenCalledWith("/mock/repo/.glop");
    expect(console.log).toHaveBeenCalledWith(
      "✓ Workspace binding removed. Hooks will no-op for this repo."
    );
  });

  it("does not remove .glop directory if it has other files", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(["other-file.txt"] as unknown as fs.Dirent[]);

    await unlinkCommand.parseAsync([], { from: "user" });

    expect(fs.unlinkSync).toHaveBeenCalledWith("/mock/repo/.glop/config.json");
    expect(fs.rmdirSync).not.toHaveBeenCalled();
  });
});

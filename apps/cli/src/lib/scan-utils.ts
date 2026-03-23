import fs from "fs";
import path from "path";

export interface ClaudeMdFileEntry {
  path: string;
  content: string;
}

export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function findClaudeMdFiles(repoRoot: string): ClaudeMdFileEntry[] {
  const files: ClaudeMdFileEntry[] = [];

  // Root CLAUDE.md
  const rootContent = readFileSafe(path.join(repoRoot, "CLAUDE.md"));
  if (rootContent) {
    files.push({ path: "CLAUDE.md", content: rootContent });
  }

  // Nested CLAUDE.md files in subdirectories (1 level deep)
  try {
    const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const content = readFileSafe(path.join(repoRoot, entry.name, "CLAUDE.md"));
      if (content) {
        files.push({ path: `${entry.name}/CLAUDE.md`, content });
      }
    }
  } catch {
    // ignore
  }

  // .claude/rules/ files
  const rulesDir = path.join(repoRoot, ".claude", "rules");
  try {
    if (fs.statSync(rulesDir).isDirectory()) {
      for (const file of fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"))) {
        const content = readFileSafe(path.join(rulesDir, file));
        if (content) {
          files.push({ path: `.claude/rules/${file}`, content });
        }
      }
    }
  } catch {
    // ignore
  }

  return files;
}

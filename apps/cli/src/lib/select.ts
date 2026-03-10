/**
 * Interactive arrow-key selector for terminal.
 * Returns the selected index, or null if cancelled (Esc / Ctrl+C).
 */
export function interactiveSelect(
  items: string[],
  initialIndex: number = 0
): Promise<number | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }

    let cursor = initialIndex;

    function render() {
      // Move cursor up to overwrite previous render (except first render)
      if (rendered) {
        process.stdout.write(`\x1b[${items.length}A`);
      }
      for (let i = 0; i < items.length; i++) {
        const isSelected = i === cursor;
        const prefix = isSelected ? "\x1b[36m❯\x1b[0m " : "  ";
        // Clear line and write
        process.stdout.write(`\x1b[2K${prefix}${items[i]}\n`);
      }
      rendered = true;
    }

    let rendered = false;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
    }

    function onData(key: string) {
      // Ctrl+C
      if (key === "\x03") {
        cleanup();
        resolve(null);
        return;
      }

      // Escape
      if (key === "\x1b" || key === "\x1b\x1b") {
        cleanup();
        resolve(null);
        return;
      }

      // Enter
      if (key === "\r" || key === "\n") {
        cleanup();
        resolve(cursor);
        return;
      }

      // Arrow up: \x1b[A
      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
        return;
      }

      // Arrow down: \x1b[B
      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % items.length;
        render();
        return;
      }
    }

    process.stdin.on("data", onData);
    render();
  });
}

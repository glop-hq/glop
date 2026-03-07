import { Command } from "commander";
import { saveConfig, getMachineId, getDefaultServerUrl } from "../lib/config.js";
import http from "http";
import { exec } from "child_process";

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  const child = exec(`${cmd} "${url}"`);
  child.unref();
}

function findOpenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find open port"));
      }
    });
  });
}

export const authCommand = new Command("auth")
  .description("Authenticate with a glop server")
  .option("-s, --server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = (opts.server || getDefaultServerUrl()).replace(/\/+$/, "");

    const port = await findOpenPort();
    const machineId = getMachineId();

    console.log("Opening browser for authentication...");
    console.log(
      "If the browser doesn't open, visit this URL manually:"
    );

    const authUrl = `${serverUrl}/cli-auth?port=${port}`;
    console.log(`  ${authUrl}\n`);
    console.log("Waiting for authorization...");

    openBrowser(authUrl);

    const result = await waitForCallback(port);

    saveConfig({
      server_url: serverUrl,
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: result.developer_name,
      machine_id: machineId,
    });

    console.log("\nAuthenticated successfully!");
    console.log(`  Developer: ${result.developer_name}`);
    console.log(`  Server:    ${serverUrl}`);
    console.log(`  Machine:   ${machineId.slice(0, 8)}...`);
    console.log(`\nAPI key saved to ~/.glop/config.json`);
    console.log(
      `\n→ Run \`glop init\` in a repo to start streaming sessions.`
    );

    process.exit(0);
  });

interface CallbackResult {
  api_key: string;
  developer_id: string;
  developer_name: string;
}

function waitForCallback(port: number): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);

      if (url.pathname === "/callback") {
        const apiKey = url.searchParams.get("api_key");
        const developerId = url.searchParams.get("developer_id");
        const developerName = url.searchParams.get("developer_name");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(htmlPage("Authentication Failed", `<p>Error: ${escapeHtml(error)}</p><p>You can close this tab.</p>`));
          clearTimeout(timeout);
          server.close();
          reject(new Error(error));
          return;
        }

        if (apiKey && developerId && developerName) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(htmlPage("Authenticated!", `<p>You can close this tab and return to the terminal.</p>`));
          clearTimeout(timeout);
          server.close();
          resolve({
            api_key: apiKey,
            developer_id: developerId,
            developer_name: developerName,
          });
          return;
        }

        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(htmlPage("Error", "<p>Missing parameters. Please try again.</p>"));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(port, "127.0.0.1");
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>glop - ${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fafafa}
.card{background:white;border:1px solid #e5e5e5;border-radius:8px;padding:2rem;text-align:center;max-width:400px}
h1{margin:0 0 1rem;font-size:1.25rem}</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1>${body}</div></body>
</html>`;
}

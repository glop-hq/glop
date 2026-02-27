import { Command } from "commander";
import { saveConfig, getMachineId } from "../lib/config.js";
import readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const authCommand = new Command("auth")
  .description("Authenticate with a glop server")
  .option("-s, --server <url>", "Server URL")
  .option("-n, --name <name>", "Developer name")
  .action(async (opts) => {
    const serverUrl =
      opts.server || (await prompt("Server URL: "));
    const developerName =
      opts.name || (await prompt("Your name: "));

    if (!serverUrl || !developerName) {
      console.error("Server URL and name are required.");
      process.exit(1);
    }

    // Normalize URL
    const baseUrl = serverUrl.replace(/\/+$/, "");

    console.log(`Registering with ${baseUrl}...`);

    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developer_name: developerName }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        console.error(
          `Registration failed: ${(error as Record<string, string>).error || res.statusText}`
        );
        process.exit(1);
      }

      const data = (await res.json()) as {
        api_key: string;
        developer_id: string;
      };
      const machineId = getMachineId();

      saveConfig({
        server_url: baseUrl,
        api_key: data.api_key,
        developer_id: data.developer_id,
        developer_name: developerName,
        machine_id: machineId,
      });

      console.log("Authenticated successfully!");
      console.log(`  Developer: ${developerName}`);
      console.log(`  Server:    ${baseUrl}`);
      console.log(`  Machine:   ${machineId.slice(0, 8)}...`);
      console.log(`\nAPI key saved to ~/.glop/config.json`);
    } catch (err) {
      console.error(
        `Failed to connect to ${baseUrl}:`,
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  });

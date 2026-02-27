#!/usr/bin/env node

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { setupCommand } from "./commands/setup.js";
import { statusCommand } from "./commands/status.js";

const program = new Command()
  .name("glop")
  .description("Passive control plane for local Claude-driven development")
  .version("0.1.0");

program.addCommand(authCommand);
program.addCommand(setupCommand);
program.addCommand(statusCommand);

program.parse();

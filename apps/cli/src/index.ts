#!/usr/bin/env node

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { deactivateCommand } from "./commands/deactivate.js";
import { hookCommand } from "./commands/hook.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";

const program = new Command()
  .name("glop")
  .description("Passive control plane for local Claude-driven development")
  .version("0.1.0");

program.addCommand(authCommand);
program.addCommand(deactivateCommand);
program.addCommand(hookCommand, { hidden: true });
program.addCommand(initCommand);
program.addCommand(statusCommand);

program.parse();

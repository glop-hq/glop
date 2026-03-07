#!/usr/bin/env node

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { deactivateCommand } from "./commands/deactivate.js";
import { doctorCommand } from "./commands/doctor.js";
import { hookCommand } from "./commands/hook.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import pkg from "../package.json";

const program = new Command()
  .name("glop")
  .description("Passive control plane for local Claude-driven development")
  .version(pkg.version);

program.addCommand(authCommand);
program.addCommand(deactivateCommand);
program.addCommand(doctorCommand);
program.addCommand(hookCommand, { hidden: true });
program.addCommand(initCommand);
program.addCommand(statusCommand);

program.parse();

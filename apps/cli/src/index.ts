#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { unlinkCommand } from "./commands/unlink.js";
import { doctorCommand } from "./commands/doctor.js";
import { hookCommand } from "./commands/hook.js";
import { linkCommand } from "./commands/link.js";
import { updateCommand } from "./commands/update.js";
import { scanCommand } from "./commands/scan.js";
import { insightsCommand } from "./commands/insights.js";
import { tipCommand } from "./commands/tip.js";
import { checkForUpdate } from "./lib/update-check.js";
import pkg from "../package.json";

const program = new Command()
  .name("glop")
  .description("Passive control plane for local Claude-driven development")
  .version(pkg.version);

program.addCommand(loginCommand);
program.addCommand(unlinkCommand);
program.addCommand(doctorCommand);
program.addCommand(hookCommand, { hidden: true });
program.addCommand(linkCommand);
program.addCommand(updateCommand);
program.addCommand(scanCommand);
program.addCommand(insightsCommand);
program.addCommand(tipCommand);
program.hook("postAction", async (_thisCommand, actionCommand) => {
  if (actionCommand.name() === "__hook") return;
  await checkForUpdate(pkg.version);
});

program.parse();

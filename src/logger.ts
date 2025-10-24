import { red, bold, green, yellow } from "colorette";
import util from "util";
import { TelegramApiError } from "@/services/telegram/errors.js";

// This one is a loger Router that logs either in custom format based
// on error class or straight to console
export function logError(err: unknown) {
  if (err instanceof TelegramApiError) err.log();
  else console.error(err);
  return;
}

// These are just wrappers to create colored messages with flags like [FATAL]

export function logFatal(...args: any[]) {
  const formatted = util.formatWithOptions({ colors: false }, ...args);
  console.error(red(bold(`[FATAL] ${formatted}`)));
}

export function logWarn(...args: any[]) {
  const formatted = util.formatWithOptions({ colors: false }, ...args);
  console.error(yellow(bold(`[WARN] ${formatted}`)));
}

export function logSuccess(...args: any[]) {
  const formatted = util.formatWithOptions({ colors: false }, ...args);
  console.error(green(bold(`[OK] ${formatted}`)));
}

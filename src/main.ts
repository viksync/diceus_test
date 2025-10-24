import express from "express";
import morgan from "morgan";
import { PORT } from "@/config.js";
import {
  throw_if_missing_env,
  validate_webhook,
  retryForever,
  gracefulShutdown,
  registerProcessHandlers,
} from "@/utils.js";
import { logError, logFatal, logSuccess } from "@/logger.js";
import handleWebhook from "./routes/webhook.js";
import { TelegramApiError } from "@/services/telegram/errors.js";
import { validateTelegramUpdate } from "@/middleware/webhook.js";

async function main() {
  console.log("Initializing");

  // STEP 1: make sure everything is correctly set up and we can start the server

  // This will throw if env variables aren't set
  throw_if_missing_env();

  // This calls Telegram API getWebhookInfo to make the webhook was set up correctly
  // It checks url, permissions etc.
  try {
    await validate_webhook();
  } catch (err) {
    logError(err);

    // We imidiately exit because 404 means either webhook method name was mistyped
    // BOT_TOKEN is invalid
    if (err instanceof TelegramApiError && err.code === 404) process.exit(1);

    /* This is used to ensure server can come online automatically as soon
     * as network connectivity or the Telegram service is available.
     * It retries every `SERVER_START_RETRY_DELAY` (1 second).
     */
    await retryForever(() => validate_webhook(), err);
  }

  // STEP 2: configure Express

  const app = express();
  app.use(morgan("dev"));
  app.use(express.json());
  // Disable this header to avoid exposing Express and make attacker's life harder
  app.disable("x-powered-by");

  app.post("/webhook", validateTelegramUpdate, handleWebhook);

  const server = app.listen(PORT);
  server.setTimeout(15000);
  server.headersTimeout = 16000;

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logFatal(`Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      logFatal("Server error: ", err);
      process.exit(1);
    }
  });

  server.on("listening", () => {
    logSuccess(`Server on\n[PORT]: ${PORT}\n[PID]: ${process.pid}`);
  });

  // Registering graceful shutdown on SIGINT and SIGTERM
  ["SIGINT", "SIGTERM"].forEach((sig) =>
    process.on(sig, () => gracefulShutdown(sig, server))
  );
}

// Registers handlers for uncaught exceptions and rejections.
// Last line of defense to keep the server from going down.
registerProcessHandlers();

main().catch((err) => {
  logFatal(err);
  process.exit(1);
});

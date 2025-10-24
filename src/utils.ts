import { getWebhookInfo, setWebhookInfo } from "@/services/telegram/api.js";
import {
  SERVER_URL,
  WEBHOOK_ALLOWED_UPDATES,
  FORCE_SHUTDOWN_TIMEOUT,
  SERVER_START_RETRY_DELAY,
  REQUIRED_ENV,
} from "@/config.js";
import type { Server } from "http";
import { logFatal, logWarn } from "@/logger.js";

/**
 * Sets up global process handlers to catch and log unhandled promise rejections
 * and uncaught exceptions. This ensures that critical errors are recorded before
 * the application terminates.
 */
export function registerProcessHandlers() {
  process.on("unhandledRejection", (reason, promise) => {
    logFatal("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    logFatal("Uncaught Exception:", error);
  });
}

/**
 * Checks for the presence of all required environment variables defined in the
 * configuration. If any are missing, it throws an error to prevent the
 * application from starting with an incomplete configuration.
 */
export function throw_if_missing_env() {
  const required = Object.keys(REQUIRED_ENV);
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw `Missing env variables\n${missing.join("\n")}`;
  }
}

/**
 * Validates the current Telegram webhook configuration. If the registered URL
 * or allowed updates do not match the server's configuration, it attempts to
 * set the correct webhook.
 *
 * @throws {TelegramApiError} If the underlying API calls to `getWebhookInfo`
 * or `setWebhookInfo` fail due to network issues, invalid responses, or
 * other API-related problems.
 */
export async function validate_webhook() {
  const res = await getWebhookInfo();

  const receivedUpdates = JSON.stringify(res.allowed_updates);
  const expectedUpdates = JSON.stringify(WEBHOOK_ALLOWED_UPDATES);

  if (res.url !== SERVER_URL || receivedUpdates !== expectedUpdates) {
    logWarn("Retrying to set a correct webhook");
    await setWebhookInfo();
  }
}

/**
 * Handles graceful shutdown of the server.
 *
 * It closes all connections and stops the server upon receiving a termination
 * signal.
 *
 * If the server doesn’t close before FORCE_SHUTDOWN_TIMEOUT, we force it.
 *
 * @param sig The signal received
 * @param server The server instance to shut down.
 */
export function gracefulShutdown(sig: string, server: Server) {
  logWarn(`Received ${sig}`);
  server.closeAllConnections();
  server.close(() => {
    logFatal("Server closed.", "Exiting...");
    process.exit(0);
  });

  setTimeout(() => {
    logFatal("Server was forcefully shut down");
    process.exit(1);
  }, FORCE_SHUTDOWN_TIMEOUT);
}

/**
 * Continuously retries an asynchronous function until it succeeds.
 *
 * This function is used to start the server, ensuring it can come
 * online automatically as soon as network connectivity or the Telegram service
 * is available. It retries every `SERVER_START_RETRY_DELAY` (1 second).
 *
 * To avoid spamming the logs, it intelligently logs errors only when the error
 * message changes from the previous attempt.
 *
 * @param fn The async function to retry.
 * @param initialError An optional initial error to log before the first retry.
 * @param args Arguments to pass to the function.
 */
export async function retryForever<T extends any[]>(
  fn: (...args: T) => Promise<void>,
  initialError: unknown = null,
  ...args: T
) {
  let attempt = 1;
  let lastError =
    initialError instanceof Error ? initialError.message : String(initialError);
  while (true) {
    console.log(
      `Retrying in ${SERVER_START_RETRY_DELAY / 1000}s [Attempt ${attempt}]`
    );
    await new Promise((resolve) =>
      setTimeout(resolve, SERVER_START_RETRY_DELAY)
    );

    try {
      await fn(...args);
      return;
    } catch (err) {
      attempt++;
      const currentError = err instanceof Error ? err.message : String(err);

      if (currentError !== lastError) {
        console.error(err);
      }

      lastError = currentError;
    }
  }
}

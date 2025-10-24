import { ZodError } from "zod";
import { red, bold } from "colorette";

/**
 * Custom error class for handling and formatting Telegram API errors.
 *
 * The `name` property gives a quick snapshot of what went wrong:
 * error type, HTTP method, Telegram API method, and HTTP code (when relevant).
 *
 * It also cleans up and formats details from different error types
 * (like `ZodError`, `SyntaxError` from JSON parsing, etc.),
 * providing a clear, concise summary without the noise.
 *
 * @example
 * // For a Zod validation error on the 'sendMessage' method
 * "[ERROR] Telegram API > ZodError > POST > sendMessage"
 *
 * @example
 * // For a 404 Not Found error
 * "[ERROR] Telegram API > POST > sendMessage > 404"
 */
export class TelegramApiError extends Error {
  public readonly details?: string;
  public readonly type?: string;

  public readonly apiMethod?: string;
  public readonly httpMethod?: string;
  public readonly code?: number;
  public readonly err?: unknown;

  constructor(params: {
    apiMethod?: string;
    httpMethod?: string;
    code?: number;
    details?: string;
    err?: unknown;
  }) {
    super();

    this.apiMethod = params.apiMethod;
    this.httpMethod = params.httpMethod;
    this.code = params.code;
    this.err = params.err;
    this.details = params.details;

    // For some reason Telegram return 404 if BOT_TOKEN is wrong
    if (this.code === 404) {
      this.details = "Invalid URL or BOT_TOKEN";
    }

    if (this.err instanceof ZodError) {
      this.details = formatZodErrorMessage(this.err);
      this.type = "ZodError";
      // No need for HTTP code. It's always 200 for validation errors
      this.code = undefined;
    }

    // This is for the case when req.body isn't a valid JSON
    if (this.err instanceof SyntaxError || this.err instanceof TypeError) {
      this.type = ".json()";
      this.details = this.err.message;
    }

    // Here we construct the error.name
    this.name = [
      "[ERROR] Telegram API",
      this.type,
      this.httpMethod,
      this.apiMethod,
      this.code,
    ]
      .filter((v) => v ?? false)
      .join(" > ");
  }

  /**
   * Logs the formatted error message to the console in this order:
   * 1. Readable name
   * 2. Helpful details summary (if available)
   * 3. Stack trace
   */
  log() {
    console.error(bold(red(this.name)));

    if (this.details) console.error(this.details);

    // Here we delete the name from stack to dedup
    const stackLines = this.stack?.split("\n") || [];
    const stackTrace = stackLines.slice(1).join("\n");
    console.error("\n" + stackTrace + "\n");
  }
}

/**
 * Formats a ZodError's mess issues into a readable, numbered list.
 * Each issue is presented on a new line with its path and message.
 *
 * @param err The ZodError instance.
 * @returns A formatted string describing the validation issues.
 * @example
 * // Returns:
 * // 1. field.nested - invalid literal value, expected "something"
 * // 2. other_field - expected string, received number
 */
function formatZodErrorMessage(err: ZodError): string {
  return err.issues
    .map((issue, i) => {
      const path = issue.path.join(".");
      return `${i + 1}. ${path} - ${issue.message.toLocaleLowerCase()}`;
    })
    .join("\n");
}

/**
 * Telegram Bot API wrapper.
 *
 * Provides typed functions for common bot operations: sending messages,
 * uploading files, managing webhooks. Handles MarkdownV2 escaping automatically.
 */

import * as tgSchemas from "@/services/telegram/schemas.js";
import {
  API_URL,
  BOT_TOKEN,
  SERVER_URL,
  WEBHOOK_ALLOWED_UPDATES,
  SECRET_TOKEN,
} from "@/config.js";
import { TelegramApiError } from "@/services/telegram/errors.js";
import { ZodSchema } from "zod";

/**
 * Escapes text for MarkdownV2 while preserving common markdown syntax.
 * Escapes: _ [ ] ( ) ~ > # + - = | { } . !
 * Preserves: * (for bold) ` (for code)
 */
function escapeForMarkdownV2(text: string): string {
  return text.replace(/([_\[\]()~>#+=|{}.!\\-])/g, "\\$1");
}

export async function sendMessage(
  chat_id: number,
  message: string,
  parse_mode = "MarkdownV2"
) {
  const payload: Record<string, number | string> = {
    chat_id,
    text: parse_mode === "MarkdownV2" ? escapeForMarkdownV2(message) : message,
  };

  if (parse_mode) {
    payload.parse_mode = parse_mode;
  }

  const { data } = await POST("SendMessage", payload);

  return {
    ok: data.ok,
    message_id: data.result.message_id,
  };
}

export async function deleteMessage(chat_id: number, message_id: number) {
  const { data } = await POST("deleteMessage", { chat_id, message_id });
  return data;
}

export async function sendDocument(
  chat_id: number,
  document: Buffer,
  filename: string,
  caption?: string
) {
  const formData = new FormData();
  formData.append("chat_id", chat_id.toString());
  formData.append("document", new Blob([new Uint8Array(document)]), filename);

  if (caption) {
    formData.append("caption", caption);
  }

  const { data } = await POST("sendDocument", formData);
  return data.ok;
}

export async function getFile(file_id: string) {
  const { data, metadata } = await GET("getFile", {
    parameters: { file_id },
  });

  // We don't use zod because we need to check only one prop to be string
  const file_path = data?.result?.file_path;
  if (typeof file_path === "string")
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`;
  else
    throw new TelegramApiError({
      ...metadata,
      details: "file_path is not string",
    });
}

export async function getWebhookInfo() {
  const { data } = await GET("getWebhookInfo", {
    schema: tgSchemas.getWebhookInfo,
  });

  return {
    url: data.result.url,
    allowed_updates: data.result.allowed_updates,
  };
}

export async function setWebhookInfo() {
  const { data, metadata } = await POST("setWebhook", {
    url: SERVER_URL,
    allowed_updates: WEBHOOK_ALLOWED_UPDATES,
    secret_token: SECRET_TOKEN,
  });

  // Telegram always responds with success so we have to check result prop
  // and optionally rethrow
  if (!data.result)
    throw new TelegramApiError({
      ...metadata,
      details: data.description,
    });

  return data.result;
}

/**
 * Flexible POST helper - handles both JSON and FormData payloads automatically.
 *
 * Detects payload type and sets appropriate headers/body encoding. Centralizes error handling -
 * all HTTP/parsing errors are thrown as TelegramApiError. Business logic can catch as needed.
 *
 * @throws {TelegramApiError} on HTTP errors or JSON parse errors
 */
async function POST(apiMethod: string, payload: object | FormData) {
  // STEP 1 - Detect payload type
  const isFormData = payload instanceof FormData;

  // STEP 2 - Make request with appropriate encoding
  const res = await fetch(API_URL + "/" + apiMethod, {
    method: "POST",
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    body: isFormData ? payload : JSON.stringify(payload),
  });

  // STEP 3 - Collect metadata for meaningful error messages
  const metadata = {
    code: res.status,
    httpMethod: "POST",
    apiMethod,
  };

  // STEP 4 - Parse JSON response
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new TelegramApiError({ ...metadata, err });
  }

  // STEP 5 - Check HTTP status and throw if error
  if (!res.ok) {
    throw new TelegramApiError({
      ...metadata,
      details: data.description,
    });
  }

  return { metadata, data };
}

/**
 * Flexible GET helper - handles URL params, JSON parsing, and optional Zod validation.
 *
 * Centralizes error handling - all HTTP/parsing/validation errors are thrown as TelegramApiError.
 * Business logic can catch and handle errors as needed without worrying about the details.
 *
 * @throws {TelegramApiError} on HTTP errors, JSON parse errors, or schema validation failures
 */
async function GET(
  apiMethod: string,
  options?: {
    parameters?: Record<string, string>; // Auto-added as URL query params
    schema?: ZodSchema; // Optional Zod validation - parsed if provided
  }
) {
  // STEP 1 — create URL with optional parameters
  const url = new URL(API_URL + "/" + apiMethod);

  if (options?.parameters) {
    for (const [key, value] of Object.entries(options.parameters)) {
      url.searchParams.set(key, value);
    }
  }

  // STEP 2
  const res = await fetch(url);

  // STEP 3 - Collect metadata for meaningful error messages
  const metadata = {
    code: res.status,
    httpMethod: "GET",
    apiMethod,
  };

  if (!res.ok) throw new TelegramApiError(metadata);

  // STEP 4 - parse JSON and optionally validate with Zod
  try {
    let data = await res.json();
    if (options?.schema) data = options.schema.parse(data);
    return { metadata, data };
  } catch (err) {
    throw new TelegramApiError({ ...metadata, err });
  }
}

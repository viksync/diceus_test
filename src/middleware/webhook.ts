import type { Request, Response, NextFunction } from "express";
import * as tgSchemas from "@/services/telegram/schemas.js";
import { SECRET_TOKEN } from "@/config.js";

/**
 * This middleware validates incoming data from the Telegram API with Zod and
 * immediately responds with the appropriate status code to prevent timeouts
 * and duplicate webhook calls. Without this, Telegram might resend the same update
 * if our business logic takes too long to run.
 *
 */
export async function validateTelegramUpdate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Telegram always includes this header, so we can trust the request came from them.
  if (req.headers["x-telegram-bot-api-secret-token"] !== SECRET_TOKEN)
    return res.sendStatus(404);

  const body = await tgSchemas.Update.safeParseAsync(req.body);

  if (!body.success) {
    console.log(body.error);
    return res.sendStatus(422);
  }

  req.body = body.data;
  res.sendStatus(200);

  return next();
}

export const SERVER_URL = process.env.SERVER_URL!;
export const PORT = Number(process.env.PORT);
export const FORCE_SHUTDOWN_TIMEOUT = 5000;
export const SERVER_START_RETRY_DELAY = 1000;

export const MAX_FILE_SIZE = 10485760;

export const SECRET_TOKEN = process.env.SECRET_TOKEN!;
export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
export const WEBHOOK_ALLOWED_UPDATES = ["message"];

export const MINDEE_API_KEY = process.env.MINDEE_API_KEY;
export const MINDEE_DRIVER_LICENCE_MODEL_ID =
  process.env.MINDEE_DRIVER_LICENCE_MODEL_ID!;
export const MINDEE_PASSPORT_MODEL_ID = process.env.MINDEE_PASSPORT_MODEL_ID!;

export const REQUIRED_ENV = {
  SECRET_TOKEN,
  BOT_TOKEN,
  SERVER_URL,
  PORT,
  MINDEE_API_KEY,
  MINDEE_DRIVER_LICENCE_MODEL_ID,
  MINDEE_PASSPORT_MODEL_ID,
};

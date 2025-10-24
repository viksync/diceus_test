export type TelegramMessage = {
  from: {
    id: number;
  };
  text?: string;
  entities?: Array<{
    type: string;
  }>;
  document?: {
    mime_type: string;
    file_id: string;
    file_size: number;
  };
  photo?: Array<{
    file_id: string;
    file_size: number;
  }>;
};

export type TelegramUpdate = {
  update_id: number;
  message: TelegramMessage;
};

// we use unsupported for tyeps of content we don't care about
// like location, sticker, video etc.
// this allows us to send a fallback answer if bot gets one of them
export type TelegramMessageContent =
  | "text"
  | "command"
  | "photo"
  | "document"
  | "unsupported";

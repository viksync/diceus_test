import type { UserSession } from "../session/UserSession.js";
import type {
  TelegramMessage,
  TelegramMessageContent,
} from "../services/telegram/types.js";

export type Handler = (
  chat_id: number,
  userState: UserSession,
  contentType: TelegramMessageContent,
  message: TelegramMessage
) => void | Promise<void>;

interface BaseStepConfig {
  handler: Handler;
  expectsContent: TelegramMessageContent[];
  expectedAction: string;
}

// Configuration for document processing steps
export interface DocumentStepConfig extends BaseStepConfig {
  documentType: "passport" | "driver's license";
}

// Configuration for confirmation steps
export interface ConfirmationStepConfig extends BaseStepConfig {
  onAccept?: (chat_id: number, userState: UserSession) => void | Promise<void>;
  onReject?: (chat_id: number, userState: UserSession) => void | Promise<void>;
}

// Map each step to its specific config type
export type StepConfigMap = {
  start: BaseStepConfig;
  awaiting_passport: DocumentStepConfig;
  confirming_passport: ConfirmationStepConfig;
  awaiting_driversId: DocumentStepConfig;
  confirming_driversId: ConfirmationStepConfig;
  confirming_price: ConfirmationStepConfig;
  sending_policy: BaseStepConfig;
  completed: BaseStepConfig;
};

export type { BaseStepConfig };

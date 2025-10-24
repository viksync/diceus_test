import type { Request } from "express";
import type {
  TelegramMessageContent,
  TelegramMessage,
  TelegramUpdate,
} from "@/services/telegram/types.js";
import { sessionStorage } from "@/session/SessionStorage.js";
import { stepConfigs } from "@/handlers/step_configs.js";
import { sendMessage } from "@/services/telegram/api.js";
import { promptAgent } from "@/services/agent/promptAgent.js";
import { logError } from "@/logger.js";

/**
 * Routes incoming Telegram messages to the appropriate handler based on:
 * 1. What the user sent (photo, document, text, command)
 * 2. What step they're currently at (awaiting_passport, confirming_price, etc.)
 *
 * Flow:
 * - Expected content → Execute step handler (e.g., process document, confirm data)
 * - Unexpected text/command → Route to AI agent for conversational recovery
 * - Unsupported content → Send error message
 */
export default async (req: Request) => {
  // Request already validated by middleware
  const body = req.body as TelegramUpdate;

  try {
    const { message } = body;
    const chat_id = message.from.id;
    const contentType = getContentType(message);
    // photo | document | text | command | unsupported

    const userState = sessionStorage.get(chat_id);
    const stepConfig = stepConfigs[userState.step];

    console.log(userState.driversIdData);
    console.log("pp");
    console.log(userState.passportData);

    // GATE 1: Filter out unsupported content (stickers, videos, etc.)
    if (contentType === "unsupported") {
      const fallback = `Sorry, I can't process that.\n\nPlease, ${stepConfig.expectedAction}`;
      await sendMessage(chat_id, fallback);
      return;
    }

    // GATE 2: Check if content matches what we expect for this step
    // Special case: If both document extraction methods failed (AI agent + Mindee),
    // we ask user to type their info manually. This flag lets text pass through.
    const isManualInput =
      userState.awaitingManualInput && contentType === "text";

    const isExpectedContent =
      stepConfig.expectsContent?.includes(contentType) || isManualInput;

    if (isExpectedContent) {
      try {
        await stepConfig.handler(chat_id, userState, contentType, message);
        return;
      } catch (err) {
        logError(err);
        await sendMessage(
          chat_id,
          `Please, send: ${stepConfig.expectsContent?.join(" or ")}`
        );
        return;
      }
    }

    // GATE 3: Handle unexpected content types

    const fallbackMessage = `Sorry, I can't process that.\n\nPlease, ${stepConfig.expectedAction}`;

    // Unexpected text/command - try to handle conversationally with AI agent
    // If agent's not available - send fallback message
    // Example: User asks "What documents do I need?" while at awaiting_passport step
    if (contentType === "text" || contentType === "command") {
      userState.addToConversationHistory(message.text!, "user");

      try {
        const agentResponse = await promptAgent(
          chat_id,
          message.text!,
          userState,
          "User sent unexpected message. Try to figure out user intent and help them."
        );

        await sendMessage(chat_id, agentResponse);
        userState.addToConversationHistory(agentResponse, "assistant");
        return;
      } catch (err) {
        logError(err);
        await sendMessage(chat_id, fallbackMessage);
        // We don't add fallback to history not to pollute agent context
        return;
      }
    }

    // Unexpected photo/document - just send the fallback message
    if (contentType === "document" || contentType === "photo") {
      await sendMessage(chat_id, fallbackMessage);
      return;
    }
  } catch (err) {
    logError(err);
  }
};

/**
 * Determines the type of content in a Telegram message.
 *
 * @param message The incoming Telegram message object.
 * @returns "photo", "document", "command", text", or "unsupported"
 * if the type is not the one we care about: stickers, videos etc.
 */
function getContentType(message: TelegramMessage): TelegramMessageContent {
  if (message?.photo) return "photo";
  if (message?.document) return "document";

  if (message?.entities && message?.entities[0]?.type === "bot_command")
    return "command";

  if (message?.text) return "text";

  return "unsupported";
}

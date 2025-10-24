import type { UserSession } from "@/session/UserSession.js";
import type {
  TelegramMessage,
  TelegramMessageContent,
} from "@/services/telegram/types.js";
import { sendMessage } from "@/services/telegram/api.js";
import { promptAgent } from "@/services/agent/promptAgent.js";
import type { ConfirmationStepConfig } from "./step_configs.js";
import type { StepName } from "@/session/UserSession.js";

const AI_CONFIRMATION_INSTRUCTION = `Analyze the user's message. If user comfirms the data is correct craft a natural acknowledgment message, then add '[CONFIRMED]' at the very end. If a user's rejecting, craft a natural message asking them to retry, then add '[REJECTED]' at the very end. If user's asking a question or commenting, answer normally without any markers.`;

export type ManualConfirmation = "yes" | "no" | "unparseable";

/**
 * Result of AI confirmation attempt
 *
 * Success: AI successfully infered user decision
 * Failure: Either AI is down (agentUnavailable) or user asked a question (messageNeedsAnswer)
 */
type AIConfirmationResult =
  | {
      success: true;
      decision: "yes" | "no";
      message: string; // Natural response to send
    }
  | {
      success: false;
      reason: "agentUnavailable" | "messageNeedsAnswer";
      message?: string; // Only present for messageNeedsAnswer case
    };

/**
 * Handles yes/no confirmations with AI + manual fallback.
 *
 * Flow:
 * 1. Try AI agent to parse user intent
 * 2. If AI unavailable, fall back to simple "yes"/"no" matching
 * 3. Execute config callbacks (onAccept/onReject) or default step navigation
 */
export async function handleConfirmation(
  chat_id: number,
  userState: UserSession,
  contentType: TelegramMessageContent,
  message: TelegramMessage,
  config: ConfirmationStepConfig
) {
  const userMessage = message.text!;

  // PATH 1 - Ask AI to analyze user's message and determine intent
  const result = await getAIConfirmation(userMessage, userState, chat_id);

  // RESULT 1 - AI successfully detected answer - send response and act on decision
  if (result.success) {
    await sendMessage(chat_id, result.message);
    userState.addToConversationHistory(result.message, "assistant");

    // User confirmed - either run custom callback or move to next step
    if (result.decision === "yes") {
      if (config.onAccept) {
        await config.onAccept(chat_id, userState);
      } else {
        userState.nextStep();
      }
    }

    // User rejected - either run custom callback or go back a step
    if (result.decision === "no") {
      if (config.onReject) {
        config.onReject(chat_id, userState);
      } else {
        userState.prevStep();
      }
    }

    return;
  }

  // RESULT 2 - User asked a question/made a comment - AI answered conversationally
  // Just send the answer and stay at current step (don't move forward/backward)
  if (result.reason === "messageNeedsAnswer") {
    await sendMessage(chat_id, result.message!);
    userState.addToConversationHistory(result.message!, "assistant");
    return;
  }

  // RESULT 3 - AI is down - fall back to dumb "yes"/"no" string matching
  if (result.reason === "agentUnavailable") {
    console.log("Using manual confirmation fallback");
    const decision = guessDecision(userMessage); // just parses for "yes" or "no"

    if (decision === "unparseable") {
      await sendMessage(
        chat_id,
        'Please reply "yes" to confirm or "no" to retry.'
      );
      return;
    }

    /* Get generic messages for this step
     * We reuse the same logic for confirming both documents and price,
     * so we have a handler function to return correct fallback message
     */
    const messages = getMessagesForStep(userState.step);

    if (decision === "yes") {
      await sendMessage(chat_id, messages.successMessage);
      userState.addToConversationHistory(messages.successMessage, "assistant");
      if (config.onAccept) {
        await config.onAccept(chat_id, userState);
      } else {
        userState.nextStep();
      }
      return;
    }

    if (decision === "no") {
      await sendMessage(chat_id, messages.retryMessage);
      userState.addToConversationHistory(messages.retryMessage, "assistant");
      if (config.onReject) {
        config.onReject(chat_id, userState);
      } else {
        userState.prevStep();
      }
      return;
    }
  }
}

/**
 * Uses AI to parse user's confirmation intent with a clever marker trick.
 *
 * We ask the AI to append [CONFIRMED] or [REJECTED] markers to its response.
 * This lets us get both:
 * 1. A natural, conversational response to send to the user
 * 2. A machine-readable decision we can parse programmatically
 *
 * Example:
 * User: "yeah looks good!"
 * AI: "Perfect! I'll move forward with that. [CONFIRMED]"
 * We send: "Perfect! I'll move forward with that."
 * We parse: decision = "yes"
 *
 * If no marker appears, then a user neither confirmed or reject and AI
 * had to answer a question conversationally.
 */
async function getAIConfirmation(
  userMessage: string,
  userState: UserSession,
  chat_id: number
): Promise<AIConfirmationResult> {
  try {
    const agentResponse = await promptAgent(
      chat_id,
      userMessage,
      userState,
      AI_CONFIRMATION_INSTRUCTION
    );

    // Check for confirmation marker
    if (agentResponse.endsWith("[CONFIRMED]")) {
      const message = agentResponse.replace("[CONFIRMED]", "").trim();
      return { success: true, decision: "yes", message };
    }

    // Check for rejection marker
    if (agentResponse.endsWith("[REJECTED]")) {
      const message = agentResponse.replace("[REJECTED]", "").trim();
      return { success: true, decision: "no", message };
    }

    // No marker = AI answered conversationally
    return {
      success: false,
      reason: "messageNeedsAnswer",
      message: agentResponse,
    };
  } catch (error) {
    console.error("AI confirmation failed, falling back to manual parsing", {
      error,
    });
    return { success: false, reason: "agentUnavailable" };
  }
}

function getMessagesForStep(step: StepName) {
  if (step === "confirming_passport") {
    return {
      retryMessage:
        "Sorry about that! Could you try taking another photo of your passport?\n\nMake sure it's clear and well-lit so we can help you faster. Thanks! 🙌🏼",
      successMessage: "Great! Now please upload your driver's license.",
    };
  }

  if (step === "confirming_driversId") {
    return {
      retryMessage:
        "Sorry about that! Could you try taking another photo of your driver's license?\n\nMake sure it's clear and well-lit so we can help you faster. Thanks! 🙌🏼",
      successMessage:
        "Thank you for providing your information.\n\nOur standard insurance rate is $100 USD per policy. Would you like to proceed?",
    };
  }

  if (step === "confirming_price") {
    return {
      retryMessage:
        "We apologize, but $100 is the only available price for this insurance.\n\nPlease respond with 'yes' to continue or 'no' if you don't want to proceed.",
      successMessage: "Great! We'll send you your insurance shortly.",
    };
  }

  // If this throws, then we fucked up somewhere
  throw new Error("Check getMessagesForStep in @/handlers/confirm_data.ts");
}

function guessDecision(text: string): ManualConfirmation {
  const normalized = text.toLowerCase().trim();
  if (normalized === "yes") return "yes";
  if (normalized === "no") return "no";
  return "unparseable";
}

import { UserSession } from "@/session/UserSession.js";
import { sendMessage } from "@/services/telegram/api.js";
import { promptAgent } from "@/services/agent/promptAgent.js";
import {
  TelegramMessage,
  TelegramMessageContent,
} from "@/services/telegram/types.js";
import { getFileUrl } from "@/services/telegram/helpers/get_file_url.js";
import { logError } from "@/logger.js";
import type { DocumentStepConfig } from "./step_configs.js";
import { extractData } from "@/services/mindee/mindee.js";
import { createDocumentSummary } from "./utils/doc_summary.js";

/**
 * Processes document uploads (passport/driver's license) fallback strategy.
 *
 * Flow:
 * 1. Let AI handle everything including callind Mindee as a tool
 * 2. If AI fails, try direct Mindee call
 * 3. If Mindee fails, ask user to type manually
 *
 * This ensures completion regardless of service availability.
 */
export async function processDocument(
  chat_id: number,
  userState: UserSession,
  contentType: TelegramMessageContent,
  message: TelegramMessage,
  config: DocumentStepConfig
) {
  // Shortcut for handling manual text input
  if (userState.awaitingManualInput && contentType === "text") {
    await handleManualInput(chat_id, userState, message, config);
    return;
  }

  /*
   * Step 1 - Get file url
   */
  const result = await getFileUrl(
    message,
    contentType === "document" ? "document" : "photo"
  );

  // If we fail to get url, we send a template error message and wait for retry
  if (!result.success) {
    await sendMessage(chat_id, result.errorMessage);
    return;
  }

  const fileUrl = result.fileUrl;

  /*
   * Step 2 — Send processing message to let user know we are doing our job
   */
  const processingMessage =
    "*Processing your document 👀*\n\nThis may take a moment. I'll reply as soon as it's complete!";
  await sendMessage(chat_id, processingMessage);

  /*
   * Step 3 — Let agent handle the conversation
   */
  try {
    const agentPrompt =
      config.documentType === "passport"
        ? `Here's a photo of my passport: ${fileUrl}`
        : `Here's a photo of my driver's license: ${fileUrl}`;

    const agentResponse = await promptAgent(
      chat_id,
      agentPrompt,
      userState,
      "If data extracting fails add [FAILED] at the very end of your response."
    );

    if (agentResponse.endsWith("[FAILED]")) {
      const message = agentResponse.replace("[FAILED]", "").trim();
      await sendMessage(chat_id, message);
      // Stay on current step to retry
      return;
    }

    await sendMessage(chat_id, agentResponse);
    userState.nextStep();
    return;
  } catch (agentError) {
    console.error(`Agent failed during ${userState.step}`);
    logError(agentError);
  }

  /*
   * Fallback — Try to call Mindee ourselves
   */
  try {
    const documentData = await extractData(fileUrl, config.documentType);

    if (!documentData) {
      throw new Error(`No data extracted from ${config.documentType}`);
    }

    userState.setDocumentData(config.documentType, documentData);

    const confirmationMsg = createDocumentSummary(
      documentData,
      config.documentType
    );
    await sendMessage(chat_id, confirmationMsg);
    userState.addToConversationHistory(confirmationMsg, "assistant");
    userState.nextStep();
    return;
  } catch (mindeeError) {
    console.error(`Mindee fallback also failed during ${userState.step}`);
    logError(mindeeError);
  }

  /*
   * Final fallback - Ask for manual input
   */

  // Capitalize document type for user prompt
  const { documentType } = config;
  const documentTypeCapitalized =
    documentType.charAt(0).toUpperCase() + documentType.slice(1);

  const manualInputPrompt = `Please type your passport information manually:\n\n- Full name\n- ${documentTypeCapitalized} number\n- Date of birth`;

  const apologyMsg = `Sorry, I couldn't process your ${config.documentType}. ${manualInputPrompt}`;
  await sendMessage(chat_id, apologyMsg);
  userState.addToConversationHistory(apologyMsg, "assistant");
  userState.awaitingManualInput = true;
}

/*
 * For purpose of this test we just accept anything a user sends
 *
 */
async function handleManualInput(
  chat_id: number,
  userState: UserSession,
  message: TelegramMessage,
  config: DocumentStepConfig
) {
  const { text } = message;

  userState.setDocumentData(config.documentType, text!);
  userState.awaitingManualInput = false;

  const confirmationMsg = `Thank you! I've recorded your ${config.documentType} information:\n\n${text}\n\nIs this correct?`;
  await sendMessage(chat_id, confirmationMsg);
  userState.addToConversationHistory(confirmationMsg, "assistant");
  userState.nextStep();
}

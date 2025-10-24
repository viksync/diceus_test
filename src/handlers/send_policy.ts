import type { UserSession } from "@/session/UserSession.js";
import { sendDocument, sendMessage } from "@/services/telegram/api.js";
import { generatePolicyPDF } from "./utils/policy_pdf.js";
import { logError } from "@/logger.js";

const successMessage =
  "Here is your insurance policy document.\n\nThank you for choosing our service! 💛💙";
const errorMessage =
  "Sorry, there was an error with your policy. Please try again later.";

export async function sendPolicy(chat_id: number, userState: UserSession) {
  try {
    const pdfBuffer = await generatePolicyPDF(userState);

    await sendDocument(
      chat_id,
      pdfBuffer,
      `insurance_policy_${Date.now()}.pdf`,
      successMessage
    );

    userState.nextStep();
  } catch (err) {
    logError(err);
    await sendMessage(chat_id, errorMessage);
  }
}

import { sendMessage } from "@/services/telegram/api.js";
import { processDocument } from "./process_document.js";
import { handleConfirmation } from "./confirm_data.js";
import { sendPolicy } from "./send_policy.js";
import type { StepConfigMap } from "./types.js";
import { UserSession } from "@/session/UserSession.js";

export type {
  Handler,
  DocumentStepConfig,
  ConfirmationStepConfig,
} from "./types.js";

export const stepConfigs: StepConfigMap = {
  /*
   * START - Just send a welcome message
   */
  start: {
    handler: async (chat_id, userState) => {
      const welcomeMessage =
        "*Hey there!* 👋\n\nLet's get your *insurance policy* set up quickly.\n\nFirst send me a clear photo of your passport and I'll take care of the rest!\n\n*Supported formats:*\n📄 PDF\n📷 JPG, PNG, HEIC, TIFF, WebP";
      await sendMessage(chat_id, welcomeMessage);
      userState.nextStep();
    },
    expectsContent: ["command"],
    expectedAction: "use a /start command first",
  },

  /*
   * AWAITING PASSPORT - Process passport upload with 3-tier fallback
   */
  awaiting_passport: {
    handler: (chat_id, userState, contentType, message) =>
      processDocument(
        chat_id,
        userState,
        contentType,
        message,
        stepConfigs.awaiting_passport
      ),
    documentType: "passport",
    expectsContent: ["document", "photo"],
    expectedAction: "send your passport photo",
  },

  /*
   * CONFIRMING PASSPORT - Confirm extracted passport data
   */
  confirming_passport: {
    handler: (chat_id, userState, contentType, message) =>
      handleConfirmation(
        chat_id,
        userState,
        contentType,
        message,
        stepConfigs.confirming_passport
      ),
    expectsContent: ["text"],
    expectedAction: "confirm your passport data",
    onReject: async (chat_id, userState) => {
      userState.setDocumentData("passport", null);
      userState.prevStep();
    },
  },

  /*
   * AWAITING DRIVER'S LICENSE - Process driver's license upload
   */
  awaiting_driversId: {
    handler: (chat_id, userState, contentType, message) =>
      processDocument(
        chat_id,
        userState,
        contentType,
        message,
        stepConfigs.awaiting_driversId
      ),
    documentType: "driver's license",
    expectsContent: ["document", "photo"],
    expectedAction: "send your driver's license photo",
  },

  /*
   * CONFIRMING DRIVER'S LICENSE - Confirm extracted license data
   */
  confirming_driversId: {
    handler: (chat_id, userState, contentType, message) =>
      handleConfirmation(
        chat_id,
        userState,
        contentType,
        message,
        stepConfigs.confirming_driversId
      ),
    expectsContent: ["text"],
    expectedAction: "confirm your driver's license data",
    onReject: async (chat_id, userState) => {
      userState.setDocumentData("driver's license", null);
      userState.prevStep();
    },
  },

  /*
   * CONFIRMING PRICE - Confirm $100 price (fixed, no negotiation)
   */
  confirming_price: {
    handler: (chat_id, userState, contentType, message) =>
      handleConfirmation(
        chat_id,
        userState,
        contentType,
        message,
        stepConfigs.confirming_price
      ),
    onAccept: async (chat_id, userState) => {
      userState.nextStep();
      await sendPolicy(chat_id, userState);
    },
    onReject: () => {
      // User must agree to proceed
    },
    expectsContent: ["text"],
    expectedAction: "confirm or reject our offer",
  },

  /*
   * SENDING POLICY - Generate and send PDF policy document
   */
  sending_policy: {
    handler: async (chat_id, userState) => {
      await sendPolicy(chat_id, userState);
    },
    expectsContent: ["text"],
    expectedAction: "",
  },

  /*
   * COMPLETED - End state (no more actions available)
   */
  completed: {
    handler: async (chat_id) => {
      const message = "Thanks for using our service!";
      await sendMessage(chat_id, message);
    },
    expectsContent: ["text", "command"],
    expectedAction: "enjoy your newly issued policy",
  },
};

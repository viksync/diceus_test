import { assistant, user } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";
import type {
  PassportData,
  DriversLicenseData,
} from "@/services/mindee/mindee.js";

type AgentRole = "assistant" | "user";

/**
 * Stores per-user session state.
 *
 * Tracks where they are in the flow, their conversation with the AI agent,
 * and extracted document data.
 */
export class UserSession {
  static readonly STEPS = [
    "start",
    "awaiting_passport",
    "confirming_passport",
    "awaiting_driversId",
    "confirming_driversId",
    "confirming_price",
    "sending_policy",
    "completed",
  ] as const;

  private _stepIndex: number;
  private _conversation: AgentInputItem[];
  private _passportData?: PassportData | string; // Structured data OR string if it's the user manual input
  private _driversIdData?: DriversLicenseData | string;
  public awaitingManualInput?: boolean; // Fallback flag: both AI+Mindee failed, user types manually

  constructor() {
    this._stepIndex = 0;
    this._conversation = [];
  }

  get conversation(): readonly AgentInputItem[] {
    return this._conversation;
  }

  get step(): StepName {
    return UserSession.STEPS[this._stepIndex]!;
  }

  get passportData(): PassportData | string | undefined {
    return this._passportData;
  }

  get driversIdData(): DriversLicenseData | string | undefined {
    return this._driversIdData;
  }

  // We use this to manually add messages to AI's memory, not to pollute it with fallback like
  // file size should be less than 10mb etc.
  addToConversationHistory(item: any, role: AgentRole) {
    const message = role === "user" ? user(item) : assistant(item);
    this._conversation.push(message);
  }

  // Used by promptAgent to update history after agent execution
  setConversation(history: AgentInputItem[]) {
    this._conversation = history;
  }

  nextStep() {
    if (this._stepIndex < UserSession.STEPS.length - 1) {
      this._stepIndex++;
    }
  }

  prevStep() {
    if (this._stepIndex > 0) this._stepIndex--;
  }

  setDocumentData(
    documentType: "passport" | "driver's license",
    data: PassportData | DriversLicenseData | string | null
  ) {
    if (documentType === "passport")
      this._passportData = data as PassportData | string;
    else this._driversIdData = data as DriversLicenseData | string;
  }
}

export type StepName = (typeof UserSession.STEPS)[number];

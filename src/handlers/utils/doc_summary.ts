import type {
  PassportData,
  DriversLicenseData,
} from "@/services/mindee/mindee.js";

/**
 * Creates a formatted message showing extracted document data.
 *
 * Used as fallback when AI agent is unavailable - generates template-based
 * confirmation message instead of conversational response.
 */
export function createDocumentSummary(
  data: PassportData | DriversLicenseData,
  documentType: "passport" | "driver's license"
): string {
  const summary = Object.entries(data)
    .map(([key, value]) => `*${key}:* ${String(value)}`)
    .join("\n");

  return `✅ I've extracted your ${documentType} data:\n\n${summary}\n\nIs this correct?\nPlease reply with "yes" or "no".`;
}

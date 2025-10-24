import { run, user } from "@openai/agents";
import { agent } from "@/services/agent/agent.js";
import type { UserSession } from "@/session/UserSession.js";

export async function promptAgent(
  chat_id: number,
  userMessage: string,
  userState: UserSession,
  instruction?: string
): Promise<string> {
  /*
   * We enrich the AI prompt with the current step for better contextual answers.
   * We also pass chat_id so that the agent can update the user session state
   * when using tools.
   */

  const contextualMessage = [
    `# Context\nCurrent step: ${userState.step}\nUser_id=${chat_id}`,
    instruction ? `# Instruction\n${instruction}` : null,
    `# User Message\n${userMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await run(agent, [
    ...userState.conversation,
    user(contextualMessage),
  ]);

  // Simple validation instead of zod, because we care only about one string prop
  if (!result?.finalOutput || typeof result.finalOutput !== "string") {
    throw new Error("finalOutput !== string");
  }

  userState.setConversation(result.history);
  return result.finalOutput;
}

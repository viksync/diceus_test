/**
 * Configures the OpenAI agent with Mindee document parsing tools.
 *
 * The agent can call Mindee API to extract structured data from documents:
 * - parsePassport
 * - parseDriversLicence
 */

import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import systemPrompt from "@/services/agent/system_prompt.js";
import * as mindeeService from "@/services/mindee/mindee.js";
import { sessionStorage } from "@/session/SessionStorage.js";

/**
 * Both tools set the document data in user session storage
 * This is possilbe because we are passing user chat_id to agent in prompt
 */
const parsePassport = tool({
  name: "parse_passport",
  description: "Extract user info from a passport",
  parameters: z.object({
    url: z.string(),
    chat_id: z.number(),
  }),
  execute: async (input) => {
    const data = await mindeeService.getPassportData(input.url);
    const userState = sessionStorage.get(input.chat_id);
    userState.setDocumentData("passport", data);
    return JSON.stringify(data);
  },
});

const parseDriversLicence = tool({
  name: "parse_drivers_licence",
  description: "Extract user info from a driver's licence",
  parameters: z.object({
    url: z.string(),
    chat_id: z.number(),
  }),
  execute: async (input) => {
    const data = await mindeeService.getDriversData(input.url);
    const userState = sessionStorage.get(input.chat_id);
    userState.setDocumentData("driver's license", data);
    return JSON.stringify(data);
  },
});

export const agent = new Agent({
  name: "Car Insurance Assistant",
  instructions: systemPrompt,
  tools: [parsePassport, parseDriversLicence],
});

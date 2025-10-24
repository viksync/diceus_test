import * as mindee from "mindee";
import {
  MINDEE_API_KEY,
  MINDEE_PASSPORT_MODEL_ID,
  MINDEE_DRIVER_LICENCE_MODEL_ID,
} from "@/config.js";
import { InferenceFields } from "mindee/src/parsing/v2/field/inferenceFields.js";
import { INFERENCE_PARAMS } from "@/services/mindee/config.js";
import {
  RawPassportDataSchema,
  RawDriversDataSchema,
} from "@/services/mindee/schemas.js";

// Initialize the Mindee client
const mindeeClient = new mindee.ClientV2({ apiKey: MINDEE_API_KEY });

/**
 * Extracted passport data with human-readable field names
 */
export interface PassportData {
  Name: string;
  Surname: string;
  "Date of Birth": string;
  "Passport Number": string;
  "Date of Issue": string;
  "Date of Expiry": string;
}

/**
 * Extracted driver's license data with human-readable field names
 */
export interface DriversLicenseData {
  "First Name": string;
  "Last Name": string;
  "Date of Birth": string;
  "License Number": string;
  "Issued Date": string;
  "Expiry Date": string;
  Country: string;
  Category: string;
}

/**
 * Internal APIs to extract data from a document image.
 *
 * Provides a simple interface for the bot to retrieve structured passport information.
 *
 * @param url The document URL obtained from Telegram
 * @returns A promise that resolves to the extracted data.
 */
export async function getPassportData(url: string): Promise<PassportData> {
  return (await extractData(url, "passport")) as PassportData;
}
export async function getDriversData(url: string): Promise<DriversLicenseData> {
  return (await extractData(url, "driver's license")) as DriversLicenseData;
}

/**
 * The workhorse function that performs the actual document data extraction.
 *
 * Handles the complete extraction workflow:
 * 1. Selects the appropriate Mindee model based on document type
 * 2. Sends the document to Mindee API for processing
 * 3. Validates the response using Zod schemas
 * 4. Transforms the raw API to a human-readable from
 *
 * IMPORTANT: We don't return the raw API response. Instead, all data is formatted
 * with human-readable field names via this module's `makeHumanReadable` function.
 *
 * This transformation serves two purposes:
 * 1. Provides the AI Agent with clear, contextual field names for better understanding
 * 2. Ensures users receive nicely formatted messages when the AI Agent is unavailable
 *
 * @param url The URL of the document image to process.
 * @param type The type of document, either "passport" or "driver's license".
 * @returns A promise that resolves to the extracted and formatted data.
 * @throws {Error} If the response from Mindee is malformed.
 * @throws {ZodError} If the extracted data fails schema validation.
 */
export async function extractData(
  url: string,
  type: "passport" | "driver's license"
): Promise<PassportData | DriversLicenseData> {
  const model = {
    modelId:
      type === "passport"
        ? MINDEE_PASSPORT_MODEL_ID
        : MINDEE_DRIVER_LICENCE_MODEL_ID,
    ...INFERENCE_PARAMS,
  };

  const inputSource = new mindee.UrlInput({ url });

  const response = await mindeeClient.enqueueAndGetInference(
    inputSource,
    model
  );

  // Mindee API is absurdly overcomplicated and overengineered
  // So i crafted my own data extractor by inspecting their DS in debugger

  // `fields` contains all we need
  const fields = response?.inference?.result?.fields;
  if (!(fields instanceof InferenceFields))
    throw new Error("Fields aren't InferenceFields");

  // fields is an InferenceFields iterator that yields [key, fieldObject] entries
  // but the actual value isn't if fieldObject itself, it's in fieldObject.value
  // so i convert is to an array of [key, fieldObject.value] tuples
  // then i convert it to an object with Object.fromEntries
  const data = Object.fromEntries(
    Array.from(fields).map((entry) => [
      entry[0],
      // @ts-ignore - we know `value` exists
      entry[1].value,
    ])
  );

  // Validate the raw data against expected schema
  if (type === "passport") RawPassportDataSchema.parse(data);
  else RawDriversDataSchema.parse(data);

  return makeHumanReadable(data);
}

/**
 * Normalizes field keys from the Mindee API response to a human-readable format.
 *
 * For example, the API key `given_names` becomes the human-friendly "Name".
 *
 * Note: The raw data is validated before calling this function, so we can safely
 * assert the return type.
 *
 * @param data The raw validated data object with keys from the Mindee API.
 * @returns A new object with human-readable keys.
 */
function makeHumanReadable(
  data: Record<string, any>
): PassportData | DriversLicenseData {
  const labels: Record<string, string> = {
    // Passport fields
    given_names: "Name",
    surnames: "Surname",
    date_of_birth: "Date of Birth",
    passport_number: "Passport Number",
    date_of_issue: "Date of Issue",
    date_of_expiry: "Date of Expiry",

    // Driver's license fields
    first_name: "First Name",
    last_name: "Last Name",
    document_id: "License Number",
    issued_date: "Issued Date",
    expiry_date: "Expiry Date",
    country_code: "Country",
    category: "Category",
  };

  // Safe to assert since data is validated before calling this function
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [labels[key] || key, value])
  ) as PassportData | DriversLicenseData;
}

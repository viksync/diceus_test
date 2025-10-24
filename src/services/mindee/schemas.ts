import { z } from "zod";

export const RawPassportDataSchema = z.object({
  given_names: z.string(),
  surnames: z.string(),
  date_of_birth: z.string(),
  passport_number: z.string(),
  date_of_issue: z.string(),
  date_of_expiry: z.string(),
});

export const RawDriversDataSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string(),
  document_id: z.string(),
  issued_date: z.string(),
  expiry_date: z.string(),
  country_code: z.string(),
  category: z.string(),
});

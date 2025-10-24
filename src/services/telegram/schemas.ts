import { z } from "zod";

export const Message = z.object({
  from: z.object({
    id: z.number(),
  }),
  text: z.string().optional(),
  entities: z
    .array(
      z.object({
        type: z.string(),
      })
    )
    .optional(),
  document: z
    .object({
      mime_type: z.string(),
      file_id: z.string(),
      file_size: z.number(),
    })
    .optional(),
  photo: z
    .array(
      z.object({
        file_id: z.string(),
        file_size: z.number(),
      })
    )
    .optional(),
});

export const Update = z.object({
  update_id: z.number(),
  message: Message,
});

export const getWebhookInfo = z.object({
  ok: z.boolean(),
  result: z.object({
    allowed_updates: z.array(z.string()),
    url: z.string(),
  }),
});

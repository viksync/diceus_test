import type { TelegramMessage } from "@/services/telegram/types.js";
import { getFile } from "@/services/telegram/api.js";
import { MAX_FILE_SIZE } from "@/config.js";
import { MINDEE_SUPPORTED_MIME_TYPES } from "@/services/mindee/config.js";
import { logError } from "@/logger.js";

export type GetUrlResult =
  | { success: true; fileUrl: string }
  | { success: false; errorMessage: string };

// We aren't using other file types in this bot, so it's ok
type FileType = "photo" | "document";

/**
 * Generates a downloadable URL for a file from a Telegram message.
 *
 * This function processes a message containing either a 'photo' or a 'document'
 * and validates it against size and MIME types supported by MINDEE
 *
 * @param message The Telegram message object with the file.
 * @param fileType Specifies whether to process a 'photo' or a 'document'.
 * @returns A promise resolving to a `GetUrlResult` object, which contains
 *          the file URL on success or a user-friendly error message on failure.
 */
export async function getFileUrl(
  message: TelegramMessage,
  fileType: FileType
): Promise<GetUrlResult> {
  let file_id: string;
  let file_size: number;
  let mime_type: string | undefined;

  if (fileType === "photo") {
    const photos = message.photo!;

    // Telegram sends photos in multiple resolutions. The last one is the largest.
    // Let's use it to get the best results from Mindee OCR
    const fullsizePhoto = photos[photos.length - 1]!;
    file_id = fullsizePhoto.file_id;
    file_size = fullsizePhoto.file_size;
  } else {
    const { document } = message;
    file_id = document!.file_id;
    file_size = document!.file_size;
    mime_type = document!.mime_type;

    if (!MINDEE_SUPPORTED_MIME_TYPES.has(mime_type)) {
      return {
        success: false,
        errorMessage:
          "Sorry, unsupported file format. Please send a PDF, JPEG, PNG, WEBP, TIFF, or HEIC file.",
      };
    }
  }

  // Reject big files
  if (file_size > MAX_FILE_SIZE) {
    return {
      success: false,
      errorMessage:
        "Sorry, your file exceeds the *10 MB* limit. Please upload a smaller one.",
    };
  }

  // Here we are actually getting the URL
  try {
    const fileUrl = await getFile(file_id);
    return { success: true, fileUrl };
  } catch (err) {
    logError(err);
    return {
      success: false,
      errorMessage: `Oh, crap, something went wrong. Please, send your ${fileType} again`,
    };
  }
}

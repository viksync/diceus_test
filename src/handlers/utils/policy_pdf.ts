import type { UserSession } from "@/session/UserSession.js";
import PDFDocument from "pdfkit";

/**
 * Generates a dummy insurance policy PDF for demo purposes.
 * Just dumps the collected data as JSON
 */
export function generatePolicyPDF(userState: UserSession): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("CAR INSURANCE POLICY", { align: "center" });
    doc.moveDown();

    doc.text("Passport Data:");
    doc.text(JSON.stringify(userState.passportData, null, 2));
    doc.moveDown();

    doc.text("Driver's License Data:");
    doc.text(JSON.stringify(userState.driversIdData, null, 2));

    doc.end();
  });
}

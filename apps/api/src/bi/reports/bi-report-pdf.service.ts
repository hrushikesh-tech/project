import { Injectable } from "@nestjs/common";

@Injectable()
export class BiReportPdfService {
  async renderDashboardReport(snapshot: Record<string, unknown>) {
    return this.buildSimplePdf([
      "Business Intelligence Dashboard Report",
      `Generated: ${new Date().toISOString()}`,
      JSON.stringify(snapshot, null, 2),
    ]);
  }

  private buildSimplePdf(lines: string[]) {
    const escapedLines = lines
      .join("\n")
      .split("\n")
      .map((line) =>
        line
          .replaceAll("\\", "\\\\")
          .replaceAll("(", "\\(")
          .replaceAll(")", "\\)"),
      );
    const content = [
      "BT",
      "/F1 10 Tf",
      "36 800 Td",
      ...escapedLines.flatMap((line, index) =>
        index === 0 ? [`(${line}) Tj`] : ["0 -14 Td", `(${line}) Tj`],
      ),
      "ET",
    ].join("\n");

    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
  }
}

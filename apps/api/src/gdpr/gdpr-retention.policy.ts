export type GdprRetentionBehavior = "retain" | "pseudonymize" | "delete";

export type GdprRetentionPolicy = {
  subject: string;
  behavior: GdprRetentionBehavior;
  keepForDays: number | null;
  note: string;
};

export function listGdprRetentionPolicies(
  exportRetentionDays: number,
): GdprRetentionPolicy[] {
  return [
    {
      subject: "request-trace",
      behavior: "retain",
      keepForDays: 2555,
      note: "DSR request rows stay available for compliance review and audit traceability.",
    },
    {
      subject: "encrypted-export-artifact",
      behavior: "delete",
      keepForDays: exportRetentionDays,
      note: "Encrypted JSON exports expire after the configured retention window.",
    },
    {
      subject: "user-session-records",
      behavior: "pseudonymize",
      keepForDays: 0,
      note: "Local sessions are revoked and soft-deleted when a subject erasure completes.",
    },
    {
      subject: "regulated-finance-and-payroll-records",
      behavior: "pseudonymize",
      keepForDays: 2555,
      note: "Payroll and finance records keep their legal payload while direct identifiers are redacted in place.",
    },
    {
      subject: "payslip-artifacts",
      behavior: "delete",
      keepForDays: 0,
      note: "Payslip PDFs are removed from object storage once the subject record is pseudonymized.",
    },
  ];
}

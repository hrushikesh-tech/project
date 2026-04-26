"use client";

import { Mail, Package, ReceiptText } from "lucide-react";

import type { PayrollResultRecord } from "@/lib/api/client";

import { Button } from "@amdox/ui";

type PayslipActionsProps = {
  result: PayrollResultRecord;
};

export function PayslipActions({ result }: PayslipActionsProps) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <Button type="button" intent="ghost" size="sm" onClick={() => window.open(result.payslipUrl, "_blank", "noopener,noreferrer")}>
        <ReceiptText size={14} />
        Preview
      </Button>
      <Button type="button" intent="ghost" size="sm">
        <Mail size={14} />
        Bulk email
      </Button>
      <Button type="button" intent="ghost" size="sm">
        <Package size={14} />
        ZIP
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";

import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { PayrollRunDashboard } from "@/components/payroll/payroll-run-dashboard";

import { Button } from "@amdox/ui";

export default function PayrollPage() {
  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="Payroll"
        title="Run progress, payslips, and payroll artifacts"
        description="Payroll stays operationally dense but visibly alive: run stages stream into the dashboard, artifacts stay one click away, and the shell remains consistent with Finance and HR."
        badge="UI-06 live"
      />

      <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Runs workspace</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Manage payroll operations without leaving the shell</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Monitor the current run, open payslip artifacts, and spot stage failures quickly.
          </p>
        </div>
        <Link href="/dashboard/payroll/runs">
          <Button type="button">Open payroll runs</Button>
        </Link>
      </section>

      <PayrollRunDashboard />
    </section>
  );
}

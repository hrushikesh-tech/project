"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { getPayrollResults, getPayrollRuns, type PayrollRunRecord } from "@/lib/api/client";
import { subscribePayrollRunProgress } from "@/lib/payroll/progress-client";
import { queryKeys } from "@/lib/query/keys";

import { PayslipActions } from "./payslip-actions";

function stageLabel(stage: PayrollRunRecord["stage"]) {
  return stage.replaceAll("_", " ");
}

export function PayrollRunDashboard() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const [selectedRunId, setSelectedRunId] = useState<string>("run-1");
  const [progressOverrides, setProgressOverrides] = useState<Record<string, { progress: number; stage: PayrollRunRecord["stage"] }>>({});

  const payrollRuns = useQuery({
    queryKey: queryKeys.payrollRuns,
    queryFn: () => getPayrollRuns({ accessToken }),
  });

  const selectedRun = useMemo(
    () => (payrollRuns.data ?? []).find((run) => run.id === selectedRunId) ?? payrollRuns.data?.[0],
    [payrollRuns.data, selectedRunId],
  );

  const payrollResults = useQuery({
    queryKey: queryKeys.payrollResults(selectedRun?.id ?? "run-1"),
    queryFn: () => getPayrollResults(selectedRun?.id ?? "run-1", { accessToken }),
    enabled: Boolean(selectedRun?.id),
  });

  useEffect(() => {
    if (!selectedRun?.id) {
      return;
    }

    return subscribePayrollRunProgress(selectedRun.id, (snapshot) => {
      setProgressOverrides((current) => ({
        ...current,
        [selectedRun.id]: snapshot,
      }));
    });
  }, [selectedRun?.id]);

  if (payrollRuns.isLoading) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Loading payroll runs...</section>;
  }

  if (payrollRuns.isError || !selectedRun) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Payroll dashboard could not be loaded.</section>;
  }

  const progress = progressOverrides[selectedRun.id]?.progress ?? selectedRun.progress;
  const stage = progressOverrides[selectedRun.id]?.stage ?? selectedRun.stage;

  return (
    <section className="page-stack">
      <section className="grid-cards">
        {(payrollRuns.data ?? []).map((run) => {
          const override = progressOverrides[run.id];
          const effectiveProgress = override?.progress ?? run.progress;
          const effectiveStage = override?.stage ?? run.stage;

          return (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelectedRunId(run.id)}
              className="surface"
              style={{
                padding: "1.25rem",
                textAlign: "left",
                borderColor: selectedRun.id === run.id ? "rgba(15,118,110,0.28)" : undefined,
                background: selectedRun.id === run.id ? "rgba(15,118,110,0.08)" : undefined,
                cursor: "pointer",
              }}
            >
              <div className="eyebrow">{run.periodLabel}</div>
              <h3 style={{ margin: "0.35rem 0" }}>{run.name}</h3>
              <p className="muted" style={{ marginTop: 0 }}>{run.employees} employees | {run.netPayLabel}</p>
              <div
                aria-label={`${run.name} progress ${effectiveProgress}%`}
                style={{ height: "0.7rem", borderRadius: "999px", background: "rgba(15,23,42,0.08)", overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${effectiveProgress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
                  }}
                />
              </div>
              <p style={{ margin: "0.75rem 0 0", fontWeight: 600, color: "var(--brand-strong)" }}>
                {stageLabel(effectiveStage)}
              </p>
            </button>
          );
        })}
      </section>

      <section className="surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">Run progress</div>
            <h2 style={{ marginBottom: "0.35rem" }}>{selectedRun.name}</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              Progress updates stream into the dashboard without a full page reload.
            </p>
          </div>
          <div className="pill">{progress}% complete</div>
        </header>

        <div
          aria-label={`Payroll run stage ${stageLabel(stage)}`}
          style={{ height: "0.9rem", borderRadius: "999px", background: "rgba(15,23,42,0.08)", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #0f766e 0%, #22c55e 100%)",
            }}
          />
        </div>

        <section style={{ display: "grid", gap: "0.85rem" }}>
          {(payrollResults.data ?? []).map((result) => (
            <article
              key={result.id}
              className="surface"
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                boxShadow: "none",
              }}
            >
              <div>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>{result.employeeName}</strong>
                <span className="muted">{result.status} | {result.netPayLabel}</span>
              </div>
              <PayslipActions result={result} />
            </article>
          ))}
        </section>
      </section>
    </section>
  );
}

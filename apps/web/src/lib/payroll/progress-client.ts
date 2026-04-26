"use client";

import { PayrollRunStage, type PayrollRunStage as PayrollRunStageType } from "@amdox/types";

type PayrollProgressSnapshot = {
  stage: PayrollRunStageType;
  progress: number;
};

const simulatedStages: PayrollProgressSnapshot[] = [
  { stage: PayrollRunStage.SNAPSHOTTING, progress: 18 },
  { stage: PayrollRunStage.CALCULATING, progress: 42 },
  { stage: PayrollRunStage.GENERATING_PAYSLIPS, progress: 71 },
  { stage: PayrollRunStage.POSTING_LEDGER, progress: 89 },
  { stage: PayrollRunStage.COMPLETED, progress: 100 },
];

export function subscribePayrollRunProgress(
  runId: string,
  onProgress: (snapshot: PayrollProgressSnapshot) => void,
) {
  let index = 0;

  if (typeof window === "undefined") {
    return () => undefined;
  }

  const intervalId = window.setInterval(() => {
    const snapshot = simulatedStages[Math.min(index, simulatedStages.length - 1)];
    onProgress(snapshot);

    if (snapshot.stage === PayrollRunStage.COMPLETED) {
      window.clearInterval(intervalId);
      return;
    }

    index += 1;
  }, runId === "run-1" ? 2200 : 4000);

  return () => window.clearInterval(intervalId);
}

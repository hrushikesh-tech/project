export const APP_RUNTIME_MODES = {
  api: "api",
  worker: "worker",
} as const;

export type AppRuntimeMode =
  (typeof APP_RUNTIME_MODES)[keyof typeof APP_RUNTIME_MODES];

export function getAppRuntimeMode(
  value: string | undefined = process.env.APP_RUNTIME,
): AppRuntimeMode {
  return value?.trim().toLowerCase() === APP_RUNTIME_MODES.worker
    ? APP_RUNTIME_MODES.worker
    : APP_RUNTIME_MODES.api;
}

export function isApiRuntime(): boolean {
  return getAppRuntimeMode() === APP_RUNTIME_MODES.api;
}

export function isWorkerRuntime(): boolean {
  return getAppRuntimeMode() === APP_RUNTIME_MODES.worker;
}


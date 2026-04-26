"use client";

import type { OfflineAction } from "./policy";

const OFFLINE_QUEUE_KEY = "amdox-offline-queue";

async function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return import("idb-keyval");
}

export async function readOfflineQueue(): Promise<OfflineAction[]> {
  const storage = await getStorage();
  if (!storage) {
    return [];
  }

  return (await storage.get<OfflineAction[]>(OFFLINE_QUEUE_KEY)) ?? [];
}

export async function writeOfflineQueue(queue: OfflineAction[]) {
  const storage = await getStorage();
  if (!storage) {
    return;
  }

  await storage.set(OFFLINE_QUEUE_KEY, queue);
}

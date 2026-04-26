"use client";

import { readOfflineQueue, writeOfflineQueue } from "./db";
import { getOfflinePolicyMessage, isOfflineAllowed, type OfflineAction, type OfflineActionType } from "./policy";

type QueueSubscriber = (queue: OfflineAction[]) => void;

const subscribers = new Set<QueueSubscriber>();

function getBrowserWindow() {
  return window as Window & { __amdoxForceOffline?: boolean };
}

export function isEffectivelyOnline() {
  if (typeof window === "undefined") {
    return true;
  }

  const browserWindow = getBrowserWindow();
  if (browserWindow.__amdoxForceOffline) {
    return false;
  }

  return window.navigator.onLine;
}

async function emitQueue() {
  const queue = await readOfflineQueue();
  subscribers.forEach((subscriber) => subscriber(queue));
}

export function subscribeOfflineQueue(subscriber: QueueSubscriber) {
  subscribers.add(subscriber);
  void emitQueue();
  return () => {
    subscribers.delete(subscriber);
  };
}

export async function queueOfflineAction(type: OfflineActionType, payload: Record<string, unknown>) {
  if (!isOfflineAllowed(type)) {
    return {
      queued: false,
      message: getOfflinePolicyMessage(type),
    };
  }

  const queue = await readOfflineQueue();
  const nextAction: OfflineAction = {
    id: `${type}-${Date.now()}`,
    type,
    payload,
    queuedAt: new Date().toISOString(),
  };
  await writeOfflineQueue([...queue, nextAction]);
  await emitQueue();

  return {
    queued: true,
    message: "Action queued for replay when the app is back online.",
  };
}

export async function flushOfflineQueue() {
  const queue = await readOfflineQueue();
  if (!queue.length) {
    return [];
  }

  await writeOfflineQueue([]);
  await emitQueue();
  return queue;
}

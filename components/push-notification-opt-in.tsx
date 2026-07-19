"use client";

import { useState, useSyncExternalStore } from "react";
import { getFirebaseApp } from "@/lib/firebase/client";
import { saveDeviceToken } from "@/app/actions/push";

type PermissionState = NotificationPermission | "unsupported";

function subscribe() {
  // Notification.permission has no native change event to listen for --
  // the only thing that changes it is our own requestPermission() call
  // below, which triggers a re-render via setSaving() and picks up the
  // fresh value then, since this snapshot re-runs on every render.
  return () => {};
}

function getSnapshot(): PermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !getFirebaseApp()
  ) {
    return "unsupported";
  }
  return Notification.permission;
}

function getServerSnapshot(): PermissionState {
  return "unsupported";
}

export function PushNotificationOptIn() {
  const permission = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [saving, setSaving] = useState(false);

  if (permission === "unsupported" || permission === "granted" || permission === "denied") {
    return null;
  }

  async function handleEnable() {
    setSaving(true);
    try {
      const app = getFirebaseApp();
      if (!app) return;

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      const result = await Notification.requestPermission();
      if (result !== "granted") return;

      // Dynamically imported: getMessaging() touches browser-only APIs
      // (IndexedDB, ServiceWorker) and must never run at module load time,
      // where it would break server rendering of this client component.
      const { getMessaging, getToken } = await import("firebase/messaging");
      const token = await getToken(getMessaging(app), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        await saveDeviceToken(token);
      }
    } catch (err) {
      console.error("[push] enable failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={saving}
      className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
    >
      {saving ? "Enabling..." : "Enable push notifications"}
    </button>
  );
}

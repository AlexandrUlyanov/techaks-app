export type PushPromptSource = "registration" | "order";

export type PushPromptTrigger = {
  source: PushPromptSource;
  createdAt: number;
};

const PROMPT_TRIGGER_KEY = "techaks:push-prompt-trigger";
const ORDER_DISMISSED_UNTIL_KEY = "techaks:push-prompt-order-dismissed-until";
const PROMPT_EVENT = "techaks:push-prompt";
const ORDER_DISMISS_DELAY_MS = 30 * 24 * 60 * 60 * 1000;
const TRIGGER_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function markPushPromptTrigger(source: PushPromptSource) {
  if (typeof window === "undefined") return;

  const trigger: PushPromptTrigger = { source, createdAt: Date.now() };
  try {
    window.localStorage.setItem(PROMPT_TRIGGER_KEY, JSON.stringify(trigger));
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(PROMPT_EVENT, { detail: trigger }));
}

export function getPushPromptTrigger(): PushPromptTrigger | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROMPT_TRIGGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PushPromptTrigger>;
    if (
      (parsed.source !== "registration" && parsed.source !== "order") ||
      typeof parsed.createdAt !== "number" ||
      Date.now() - parsed.createdAt > TRIGGER_LIFETIME_MS
    ) {
      clearPushPromptTrigger();
      return null;
    }
    return parsed as PushPromptTrigger;
  } catch {
    return null;
  }
}

export function clearPushPromptTrigger() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROMPT_TRIGGER_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function dismissPushPrompt(source: PushPromptSource) {
  clearPushPromptTrigger();
  if (typeof window === "undefined" || source !== "order") return;
  try {
    window.localStorage.setItem(
      ORDER_DISMISSED_UNTIL_KEY,
      String(Date.now() + ORDER_DISMISS_DELAY_MS)
    );
  } catch {
    // The next order may show the prompt again if storage is unavailable.
  }
}

export function canShowPushPrompt(trigger: PushPromptTrigger) {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!("Notification" in window) || Notification.permission === "denied") return false;
  if (trigger.source !== "order") return true;

  try {
    const dismissedUntil = Number(
      window.localStorage.getItem(ORDER_DISMISSED_UNTIL_KEY) || 0
    );
    return !Number.isFinite(dismissedUntil) || dismissedUntil <= Date.now();
  } catch {
    return true;
  }
}

export function subscribeToPushPromptEvents(
  listener: (trigger: PushPromptTrigger) => void
) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const trigger = (event as CustomEvent<PushPromptTrigger>).detail;
    if (trigger) listener(trigger);
  };
  window.addEventListener(PROMPT_EVENT, handler);
  return () => window.removeEventListener(PROMPT_EVENT, handler);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export async function getExistingPushSubscription() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

export async function createPushSubscription(vapidPublicKey: string) {
  if (!vapidPublicKey.trim()) {
    throw new Error("Push-уведомления пока не настроены. Попробуйте позже.");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Этот браузер не поддерживает push-уведомления.");
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== "granted") {
    throw new Error("Разрешение на уведомления не предоставлено.");
  }

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}


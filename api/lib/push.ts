import webpush from "web-push";
import { env } from "./env";

// Initialize web-push with VAPID keys
if (env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey,
    env.vapidPrivateKey
  );
} else if (env.isProduction) {
  console.warn("VAPID keys are missing! Web Push notifications will fail in production.");
}

export type PushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: any
) {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    console.log("[MOCK PUSH] (Keys missing) Payload:", payload);
    return;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription has expired or is no longer valid
      return { success: false, expired: true };
    }
    console.error("Error sending push notification:", error);
    throw error;
  }
  return { success: true, expired: false };
}

/**
 * Generates new VAPID keys for development if needed.
 * In a real app, you'd run this once and save to .env
 */
export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}

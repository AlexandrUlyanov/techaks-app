import webpush from "web-push";
import { env } from "./env";
import { getAppSettings } from "./app-settings";

async function getVapidConfig() {
  const settings = await getAppSettings([
    "vapid_public_key",
    "vapid_private_key",
    "vapid_subject",
  ]);

  return {
    publicKey: settings.vapid_public_key || env.vapidPublicKey,
    privateKey: settings.vapid_private_key || env.vapidPrivateKey,
    subject: settings.vapid_subject || env.vapidSubject || "mailto:admin@techaks.ru",
  };
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
  const config = await getVapidConfig();

  if (!config.publicKey || !config.privateKey) {
    console.log("[MOCK PUSH] (Keys missing) Payload:", payload);
    return;
  }

  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
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

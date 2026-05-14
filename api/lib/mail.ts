import nodemailer from "nodemailer";
import { env } from "./env";
import { getAppSettings } from "./app-settings";
import dns from "node:dns/promises";

async function getTransporter() {
  const settings = await getAppSettings([
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
  ]);

  const host = settings.smtp_host || env.smtpHost;
  const port = parseInt(settings.smtp_port || env.smtpPort.toString() || "587");
  const user = settings.smtp_user || env.smtpUser;
  const pass = settings.smtp_pass || env.smtpPass;

  if (!host) return null;

  let transportHost = host;
  try {
    const resolved = await dns.lookup(host, { family: 4 });
    if (resolved?.address) {
      transportHost = resolved.address;
    }
  } catch {
    transportHost = host;
  }

  return nodemailer.createTransport({
    host: transportHost,
    port,
    secure: port === 465,
    tls: { servername: host },
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendEmailOTP(email: string, code: string) {
  const transporter = await getTransporter();
  const settings = await getAppSettings(["smtp_from"]);
  const from = settings.smtp_from || env.smtpFrom;

  if (!env.isProduction || !transporter) {
    console.log(`[MOCK EMAIL] OTP for ${email}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: `Код подтверждения TechAks: ${code}`,
    text: `Ваш код подтверждения для входа в TechAks: ${code}. Код действителен 10 минут.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #15171A; text-transform: uppercase;">Вход в ТЕХАКС</h2>
        <p>Используйте этот код для подтверждения входа в личный кабинет:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: 900; letter-spacing: 5px; border-radius: 8px;">
          ${code}
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const transporter = await getTransporter();
  const settings = await getAppSettings(["smtp_from"]);
  const from = settings.smtp_from || env.smtpFrom;

  if (!env.isProduction || !transporter) {
    console.log(`[MOCK EMAIL] Password reset for ${email}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: "Восстановление пароля TechAks",
    text: `Перейдите по ссылке для сброса пароля: ${resetUrl}. Ссылка действует 30 минут.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #15171A; text-transform: uppercase;">Восстановление пароля ТЕХАКС</h2>
        <p>Нажмите кнопку ниже, чтобы установить новый пароль.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#05C3D4;color:#111;text-decoration:none;font-weight:700;">
            Сбросить пароль
          </a>
        </p>
        <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Ссылка действует 30 минут. Если вы не запрашивали восстановление, просто проигнорируйте письмо.</p>
      </div>
    `,
  });
}

import nodemailer from "nodemailer";
import { env } from "./env";
import { getAppSettings } from "./app-settings";

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

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    family: 4,
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

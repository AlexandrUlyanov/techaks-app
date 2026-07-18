import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const JWT_SECRET = new TextEncoder().encode(
  env.appSecret || "fallback-secret-for-dev-only"
);

export type JwtPayload = {
  id: number;
  role: string;
  status: string;
  sessionId?: string;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JwtPayload;
  } catch (err) {
    return null;
  }
}

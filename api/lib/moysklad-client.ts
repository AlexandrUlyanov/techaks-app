import axios, { AxiosError, type AxiosInstance } from "axios";
import { getAppSetting } from "./app-settings";
import { env } from "./env";

const MOYSKLAD_BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const DEFAULT_TIMEOUT_MS = 90_000;

export class MoyskladApiError extends Error {
  status: number | null;
  endpoint: string;
  requestId: string | null;
  body: unknown;
  retriable: boolean;

  constructor(args: {
    message: string;
    status: number | null;
    endpoint: string;
    requestId: string | null;
    body: unknown;
    retriable: boolean;
  }) {
    super(args.message);
    this.name = "MoyskladApiError";
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.requestId = args.requestId;
    this.body = args.body;
    this.retriable = args.retriable;
  }
}

function isRetriableStatus(status: number | null, hasResponse: boolean) {
  return !hasResponse || status === 429 || (status !== null && status >= 500);
}

function getRequestId(headers?: Record<string, unknown>) {
  const headerRecord = headers ?? {};
  const candidate =
    headerRecord["x-lognex-requestid"] ??
    headerRecord["x-request-id"] ??
    headerRecord["request-id"];

  if (Array.isArray(candidate)) {
    return String(candidate[0] ?? "");
  }

  return candidate ? String(candidate) : null;
}

export async function getMoyskladAccessToken() {
  const envToken = env.moyskladToken.trim();
  if (envToken) return envToken;
  const storedToken = (await getAppSetting("moysklad_token"))?.trim() || "";
  return storedToken;
}

export async function getMoyskladClient() {
  const token = await getMoyskladAccessToken();
  if (!token) {
    throw new Error("MOYSKLAD_TOKEN не настроен.");
  }

  const instance = axios.create({
    baseURL: MOYSKLAD_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
    },
    timeout: DEFAULT_TIMEOUT_MS,
  });

  return new MoyskladClient(instance);
}

export class MoyskladClient {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async get<T>(path: string, params?: Record<string, unknown>) {
    return this.request<T>("get", path, undefined, params);
  }

  async post<T>(path: string, body?: unknown) {
    return this.request<T>("post", path, body);
  }

  async put<T>(path: string, body?: unknown) {
    return this.request<T>("put", path, body);
  }

  async delete<T>(path: string) {
    return this.request<T>("delete", path);
  }

  private async request<T>(
    method: "get" | "post" | "put" | "delete",
    path: string,
    body?: unknown,
    params?: Record<string, unknown>
  ) {
    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data: body,
        params,
      });
      return response.data;
    } catch (error) {
      throw toMoyskladApiError(error, path);
    }
  }
}

function toMoyskladApiError(error: unknown, endpoint: string) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status ?? null;
    const hasResponse = Boolean(axiosError.response);
    const body = axiosError.response?.data ?? null;
    const requestId = getRequestId(axiosError.response?.headers as Record<string, unknown>);
    const message =
      extractErrorMessage(body) ||
      axiosError.message ||
      "Ошибка запроса к МойСклад";

    console.error("[moysklad-client]", {
      endpoint,
      status,
      requestId,
      message,
      body,
    });

    return new MoyskladApiError({
      message,
      status,
      endpoint,
      requestId,
      body,
      retriable: isRetriableStatus(status, hasResponse),
    });
  }

  console.error("[moysklad-client]", {
    endpoint,
    status: null,
    requestId: null,
    message: error instanceof Error ? error.message : "Unknown MoySklad error",
    body: null,
  });

  return new MoyskladApiError({
    message: error instanceof Error ? error.message : "Unknown MoySklad error",
    status: null,
    endpoint,
    requestId: null,
    body: null,
    retriable: true,
  });
}

function extractErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;

  const errorMessage =
    (body as { errors?: Array<{ error?: string }> }).errors?.[0]?.error ??
    (body as { error?: string }).error ??
    (body as { message?: string }).message;

  return errorMessage ? String(errorMessage) : null;
}

import http from "node:http";

const port = Number(process.env.PORT || 8080);
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const routerToken = process.env.ROUTER_TOKEN || "";
const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) return "";
  return value.slice("Bearer ".length).trim();
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function handleGeminiGenerate(req, res) {
  if (routerToken) {
    const token = getBearerToken(req);
    if (!token || token !== routerToken) {
      return json(res, 401, {
        error: "Unauthorized",
      });
    }
  }

  const payload = await readJson(req);
  const model = String(payload.model || defaultModel).trim();
  const requestApiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  const effectiveApiKey = requestApiKey || geminiApiKey;
  const body = payload.body;

  if (!effectiveApiKey) {
    return json(res, 500, {
      error: "GEMINI_API_KEY is not configured on AI Router and was not provided by caller",
    });
  }

  if (!model || !body || typeof body !== "object") {
    return json(res, 400, {
      error: "Expected JSON body: { model, body }",
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": effectiveApiKey,
      },
      body: JSON.stringify(body),
    }
  );

  const text = await response.text();
  res.writeHead(response.status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        service: "ai-router",
      });
    }

    if (req.method === "POST" && req.url === "/v1/gemini/generate-content") {
      return await handleGeminiGenerate(req, res);
    }

    return json(res, 404, {
      error: "Not found",
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AI Router listening on :${port}`);
});

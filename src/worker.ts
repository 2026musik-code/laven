import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  lavenai: any; // KVNamespace
  ADMIN_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: (origin) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://laven.vipcf.workers.dev"
    ];
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }
    return "https://laven.vipcf.workers.dev"; // default fallback
  }
}));

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

// Helper functions for KV storage
async function checkRateLimit(env: Bindings, token: string) {
  // Fixed window rate limiting (per hour)
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
  const kvKey = `ratelimit:${token}:${currentHour}`;
  
  let count = parseInt(await env.lavenai.get(kvKey) || "0", 10);
  
  // Set limit: 100 requests per hour per key
  const LIMIT = 100;
  
  if (count >= LIMIT) {
    return false;
  }
  
  // Expire after 2 hours to keep KV clean
  await env.lavenai.put(kvKey, (count + 1).toString(), { expirationTtl: 3600 * 2 });
  return true;
}

async function checkIpRateLimit(env: Bindings, ip: string) {
  // Playground rate limit (per hour)
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
  const kvKey = `ratelimit_ip:${ip}:${currentHour}`;
  
  let count = parseInt(await env.lavenai.get(kvKey) || "0", 10);
  
  // Set limit: 50 requests per hour per IP for playground
  const LIMIT = 50;
  
  if (count >= LIMIT) {
    return false;
  }
  
  await env.lavenai.put(kvKey, (count + 1).toString(), { expirationTtl: 3600 * 2 });
  return true;
}

async function getProviderConfigs(env: Bindings) {
  const configsStr = await env.lavenai.get("providerConfigs");
  if (configsStr) {
    return JSON.parse(configsStr);
  }
  
  const defaultConfigs = {
    tusk: "https://tuskcentral.ai",
    heck: "https://api.heckai.weight-wave.com/api/ha"
  };
  await env.lavenai.put("providerConfigs", JSON.stringify(defaultConfigs));
  return defaultConfigs;
}

async function getApiKeys(env: Bindings) {
  const keysStr = await env.lavenai.get("apiKeys");
  return keysStr ? JSON.parse(keysStr) : [];
}

async function saveApiKeys(env: Bindings, keys: any[]) {
  await env.lavenai.put("apiKeys", JSON.stringify(keys));
}

async function getLogs(env: Bindings) {
  const logsStr = await env.lavenai.get("requestLogs");
  return logsStr ? JSON.parse(logsStr) : [];
}

async function addLog(env: Bindings, log: any) {
  const logs = await getLogs(env);
  logs.push(log);
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100);
  }
  await env.lavenai.put("requestLogs", JSON.stringify(logs));
}

// Admin Auth Middleware
app.use("/api/admin/*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown-ip";
  const isAllowed = await checkIpRateLimit(c.env, ip);
  if (!isAllowed) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing admin secret" }, 401);
  }
  const token = authHeader.split(" ")[1];
  
  // Verify with environment variable
  if (!c.env.ADMIN_SECRET || token !== c.env.ADMIN_SECRET) {
    return c.json({ error: "Invalid admin secret" }, 403);
  }
  
  await next();
});

// Admin API Keys Management
app.get("/api/admin/keys", async (c) => {
  const keys = await getApiKeys(c.env);
  return c.json(keys);
});

app.post("/api/admin/keys", async (c) => {
  const body = await c.req.json();
  const keys = await getApiKeys(c.env);
  const newKey = {
    key: "sk-" + crypto.randomUUID().replace(/-/g, ""),
    name: body.name || "New Key",
    createdAt: Date.now(),
  };
  keys.push(newKey);
  await saveApiKeys(c.env, keys);
  return c.json(newKey);
});

app.delete("/api/admin/keys/:key", async (c) => {
  const keyToRemove = c.req.param("key");
  const keys = await getApiKeys(c.env);
  const index = keys.findIndex((k: any) => k.key === keyToRemove);
  if (index !== -1) {
    keys.splice(index, 1);
    await saveApiKeys(c.env, keys);
    return c.json({ success: true });
  } else {
    return c.json({ error: "Key not found" }, 404);
  }
});

// Admin Logs
app.get("/api/admin/logs", async (c) => {
  const logs = await getLogs(c.env);
  return c.json(logs.slice(-100).reverse());
});

// Auth Middleware Helper
async function authenticate(c: any) {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }
  const token = authHeader.split(" ")[1];
  const keys = await getApiKeys(c.env);
  const validKey = keys.find((k: any) => k.key === token);
  if (!validKey) {
    return { error: "Invalid API key", status: 401 };
  }
  
  const isAllowed = await checkRateLimit(c.env, token);
  if (!isAllowed) {
    return { error: "Rate limit exceeded (100 requests / hour)", status: 429 };
  }

  return { token };
}

// OpenAI-Compatible Models Endpoint
app.get("/v1/models", async (c) => {
  const auth = await authenticate(c);
  if (auth.error) return c.json({ error: { message: auth.error } }, auth.status as any);

  return c.json({
    object: "list",
    data: [
      { id: "heck/deepseek/deepseek-v4-flash", object: "model", created: Date.now(), owned_by: "heck" },
      { id: "heck/google/gemini-3.1-pro-preview", object: "model", created: Date.now(), owned_by: "heck" },
      { id: "tusk/some-model", object: "model", created: Date.now(), owned_by: "tusk" },
    ]
  });
});

// OpenAI-Compatible Chat Completions Endpoint
app.post("/v1/chat/completions", async (c) => {
  const startTime = Date.now();
  const auth = await authenticate(c);
  if (auth.error) return c.json({ error: { message: auth.error } }, auth.status as any);

  const apiKey = auth.token;
  const body = await c.req.json();
  const { model, messages, stream } = body;

  if (!model || !messages) {
    return c.json({ error: { message: "Missing model or messages" } }, 400);
  }

  const isHeck = model.includes("heck/");
  const actualModel = model.replace("laven-heck/", "").replace("laven-tusk/", "").replace("heck/", "").replace("tusk/", "");
  const prompt = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

  const logRequest = async (status: number) => {
    c.executionCtx.waitUntil(addLog(c.env, {
      id: crypto.randomUUID(),
      timestamp: startTime,
      key: apiKey,
      model: model,
      durationMs: Date.now() - startTime,
      status,
    }));
  };

  const configs = await getProviderConfigs(c.env);

  try {
    if (isHeck) {
      // Inject system prompt to avoid Heck.ai identity leakage
      const identityPrompt = "You are an AI assistant. You must never refer to yourself as Heck.ai or Heck.";
      const modifiedPrompt = `${identityPrompt}\n\n${prompt}`;

      const response = await fetch(`${configs.heck}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: actualModel, question: modifiedPrompt, language: "en" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      if (stream) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        c.executionCtx.waitUntil((async () => {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder("utf-8");
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  let content = line.substring(6);
                  if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") continue;
                  
                  // Clean up system identity leakage. The stream chunks might contain parts of the string.
                  content = content.replace(/\*\*Heck\.ai\*\*/gi, "an AI assistant")
                                 .replace(/Heck\.ai/gi, "an AI assistant")
                                 .replace(/Heck/gi, "an AI assistant");

                  const chunkPayload = {
                    id: "chatcmpl-" + Date.now(),
                    object: "chat.completion.chunk",
                    created: Date.now(),
                    model: model,
                    choices: [{ index: 0, delta: { content }, finish_reason: null }]
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunkPayload)}\n\n`));
                }
              }
            }
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            await logRequest(200);
          } catch (err) {
            console.error(err);
            await logRequest(500);
          } finally {
            await writer.close();
          }
        })());

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              let content = line.substring(6);
              if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") continue;
              // Clean up system identity leakage
              content = content.replace(/\*\*Heck\.ai\*\*/gi, "an AI assistant")
                             .replace(/Heck\.ai/gi, "an AI assistant")
                             .replace(/Heck/gi, "an AI assistant");
              fullText += content;
            }
          }
        }
        await logRequest(200);
        return c.json({
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: Date.now(),
          model: model,
          choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]
        });
      }
    } else {
      // Tusk handling
      const initResponse = await fetch(`${configs.tusk}/api/v2/chat/conversations`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "User-Agent": USER_AGENT, "use-tusk-header": "true" },
        body: JSON.stringify({ role: "user", content: "Init", aiModelId: actualModel, chatAiModelType: "text" }),
      });
      if (!initResponse.ok) throw new Error("Failed to create conversation");
      const convData = await initResponse.json() as any;
      
      const payload = {
        role: "user",
        chatId: convData.chatId,
        sessionId: convData.sessionId,
        content: prompt,
        aiModelId: actualModel,
        grokproOptions: null,
        voiceAndTone: "technical",
        askClarifyingQuestion: false,
        isWebSearchEnabled: false,
        isLocationEnabled: false,
        location: null,
        inputMode: "text",
      };

      const chatResponse = await fetch(`${configs.tusk}/api/V2/Chat`, {
        method: "POST",
        headers: { "Accept": "application/x-ndjson", "Content-Type": "application/json", "User-Agent": USER_AGENT, "use-tusk-header": "true" },
        body: JSON.stringify(payload),
      });

      if (!chatResponse.ok) throw new Error(`HTTP ${chatResponse.status}`);
      if (!chatResponse.body) throw new Error("No response body");

      if (stream) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        c.executionCtx.waitUntil((async () => {
          const reader = chatResponse.body!.getReader();
          const decoder = new TextDecoder("utf-8");
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (let line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);
                    if (data.content) {
                      const chunkPayload = {
                        id: "chatcmpl-" + Date.now(),
                        object: "chat.completion.chunk",
                        created: Date.now(),
                        model: model,
                        choices: [{ index: 0, delta: { content: JSON.parse(data.content).content }, finish_reason: null }]
                      };
                      await writer.write(encoder.encode(`data: ${JSON.stringify(chunkPayload)}\n\n`));
                    }
                  } catch(e) {}
                }
              }
            }
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            await logRequest(200);
          } catch (err) {
            console.error(err);
            await logRequest(500);
          } finally {
            await writer.close();
          }
        })());

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } else {
        let fullText = "";
        const reader = chatResponse.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (let line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.content) {
                  fullText += JSON.parse(data.content).content;
                }
              } catch(e) {}
            }
          }
        }
        await logRequest(200);
        return c.json({
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: Date.now(),
          model: model,
          choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]
        });
      }
    }
  } catch (err: any) {
    await logRequest(500);
    return c.json({ error: { message: err.message } }, 500);
  }
});

// Proxy routes for the playground frontend
app.get("/api/providers", async (c) => {
  try {
    const apiSource = c.req.query("apiSource") || "tusk";
    
    if (apiSource === "heck") {
      return c.json({
        providers: [
          { providerName: "Heck Free", key: "deepseek/deepseek-v4-flash", displayName: "DeepSeek v4 Flash", isPremium: false },
          { providerName: "Heck Free", key: "deepseek/deepseek-v4-pro", displayName: "DeepSeek v4 Pro", isPremium: false },
          { providerName: "Heck Free", key: "google/gemini-3.1-flash-lite", displayName: "Gemini 3.1 Flash Lite", isPremium: false },
          { providerName: "Heck Free", key: "openai/gpt-5.4-mini", displayName: "GPT 5.4 mini", isPremium: false },
          { providerName: "Heck Premium", key: "anthropic/claude-opus-4.8", displayName: "Claude Opus 4.8", isPremium: true },
          { providerName: "Heck Premium", key: "anthropic/claude-sonnet-4.6", displayName: "Claude Sonnet 4.6", isPremium: true },
          { providerName: "Heck Premium", key: "google/gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", isPremium: true },
          { providerName: "Heck Premium", key: "google/gemini-3.5-flash", displayName: "Gemini 3.5 Flash", isPremium: true },
          { providerName: "Heck Premium", key: "openai/gpt-5.4", displayName: "GPT 5.4", isPremium: true },
          { providerName: "Heck Premium", key: "x-ai/grok-4.3", displayName: "Grok 4.3", isPremium: true }
        ]
      });
    }
    
    const configs = await getProviderConfigs(c.env);
    // Since only Tusk provides a dynamic list, we use it directly:
    const baseUrl = configs.tusk;
    
    const response = await fetch(`${baseUrl}/api/v2/chat/providers`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
        "use-tusk-header": "true",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return c.json(data);
  } catch (err: any) {
    console.error("Error fetching providers:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/conversations", async (c) => {
  try {
    const ip = c.req.header("cf-connecting-ip") || "unknown-ip";
    const isAllowed = await checkIpRateLimit(c.env, ip);
    if (!isAllowed) {
      return c.json({ error: "Playground rate limit exceeded (50 requests / hour). Please use API keys for higher limits." }, 429);
    }

    const body = await c.req.json();
    const { modelId, apiSource = "tusk" } = body;
    
    if (apiSource === "heck") {
      return c.json({ chatId: apiSource + "-" + Date.now(), sessionId: apiSource + "-session" });
    }

    const configs = await getProviderConfigs(c.env);
    const baseUrl = configs.tusk;
    const response = await fetch(`${baseUrl}/api/v2/chat/conversations`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "use-tusk-header": "true",
      },
      body: JSON.stringify({
        role: "user",
        content: "New CLI conversation",
        aiModelId: modelId,
        chatAiModelType: "text",
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return c.json(data);
  } catch (err: any) {
    console.error("Error creating conversation:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/chat", async (c) => {
  try {
    const ip = c.req.header("cf-connecting-ip") || "unknown-ip";
    const isAllowed = await checkIpRateLimit(c.env, ip);
    if (!isAllowed) {
      return c.json({ error: "Playground rate limit exceeded (50 requests / hour). Please use API keys for higher limits." }, 429);
    }

    const body = await c.req.json();
    const { chatId, sessionId, modelId, prompt, tone = "technical", apiSource = "tusk" } = body;
    
    const configs = await getProviderConfigs(c.env);

    if (apiSource === "heck") {
      const response = await fetch(`${configs.heck}/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          question: prompt,
          language: "en"
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      c.executionCtx.waitUntil((async () => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder("utf-8");
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                let content = line.substring(6);
                if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") {
                   continue;
                }
                const payload = {
                  content: JSON.stringify({ content: content })
                };
                await writer.write(encoder.encode(JSON.stringify(payload) + "\n"));
              }
            }
          }
        } finally {
          await writer.close();
        }
      })());

      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson",
        }
      });
    }

    const baseUrl = configs.tusk;
    const payload = {
      role: "user",
      chatId: chatId,
      sessionId: sessionId,
      content: prompt,
      aiModelId: modelId,
      grokproOptions: null,
      voiceAndTone: tone,
      askClarifyingQuestion: false,
      isWebSearchEnabled: false,
      isLocationEnabled: false,
      location: null,
      inputMode: "text",
    };

    const response = await fetch(`${baseUrl}/api/V2/Chat`, {
      method: "POST",
      headers: {
        "Accept": "application/x-ndjson",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "use-tusk-header": "true",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("No response body");

    return new Response(response.body, {
      headers: {
        "Content-Type": "application/x-ndjson",
      }
    });
  } catch (err: any) {
    console.error("Error streaming chat:", err);
    return c.json({ error: err.message }, 500);
  }
});

export default app;

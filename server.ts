import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";

const API_SOURCES: Record<string, string> = {
  tusk: "https://tuskcentral.ai",
  heck: "https://heck.ai",
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

interface ApiKey {
  key: string;
  name: string;
  createdAt: number;
}

interface RequestLog {
  id: string;
  timestamp: number;
  key: string;
  model: string;
  durationMs: number;
  status: number;
}

const apiKeys: ApiKey[] = [{ key: "sk-default-key-for-testing", name: "Default Key", createdAt: Date.now() }];
const requestLogs: RequestLog[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Admin API Keys Management
  app.get("/api/admin/keys", (req, res) => {
    res.json(apiKeys);
  });

  app.post("/api/admin/keys", (req, res) => {
    const { name } = req.body;
    const newKey: ApiKey = {
      key: "sk-" + crypto.randomBytes(16).toString("hex"),
      name: name || "New Key",
      createdAt: Date.now(),
    };
    apiKeys.push(newKey);
    res.json(newKey);
  });

  app.delete("/api/admin/keys/:key", (req, res) => {
    const index = apiKeys.findIndex(k => k.key === req.params.key);
    if (index !== -1) {
      apiKeys.splice(index, 1);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Key not found" });
    }
  });

  // Admin Logs
  app.get("/api/admin/logs", (req, res) => {
    res.json(requestLogs.slice(-100).reverse()); // Send last 100 logs
  });

  // API Gateway Middleware
  const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: { message: "Missing or invalid Authorization header" } });
    }
    const token = authHeader.split(" ")[1];
    const validKey = apiKeys.find(k => k.key === token);
    if (!validKey) {
      return res.status(401).json({ error: { message: "Invalid API key" } });
    }
    (req as any).apiKey = token;
    next();
  };

  // OpenAI-Compatible Models Endpoint
  app.get("/v1/models", requireApiKey, async (req, res) => {
    // Return a mocked combined list of models
    res.json({
      object: "list",
      data: [
        { id: "heck/deepseek/deepseek-v4-flash", object: "model", created: Date.now(), owned_by: "heck" },
        { id: "heck/google/gemini-3.1-pro-preview", object: "model", created: Date.now(), owned_by: "heck" },
        { id: "tusk/some-model", object: "model", created: Date.now(), owned_by: "tusk" },
      ]
    });
  });

  // OpenAI-Compatible Chat Completions Endpoint
  app.post("/v1/chat/completions", requireApiKey, async (req, res) => {
    const startTime = Date.now();
    const { model, messages, stream } = req.body;
    const apiKey = (req as any).apiKey;

    if (!model || !messages) {
      return res.status(400).json({ error: { message: "Missing model or messages" } });
    }

    const isHeck = model.includes("heck/");
    const actualModel = model.replace("laven-heck/", "").replace("laven-tusk/", "").replace("heck/", "").replace("tusk/", "");
    const prompt = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

    const logRequest = (status: number) => {
      requestLogs.push({
        id: crypto.randomUUID(),
        timestamp: startTime,
        key: apiKey,
        model: model,
        durationMs: Date.now() - startTime,
        status,
      });
    };

    try {
      if (isHeck) {
        const response = await fetch("https://api.heckai.weight-wave.com/api/ha/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: actualModel, question: prompt, language: "en" }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                let content = line.substring(6);
                if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") continue;
                
                const chunkPayload = {
                  id: "chatcmpl-" + Date.now(),
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  model: model,
                  choices: [{ index: 0, delta: { content }, finish_reason: null }]
                };
                res.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
              }
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
          logRequest(200);
          return;
        } else {
          // Non-streaming heck implementation (we'll just read the stream and concatenate)
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
                fullText += content;
              }
            }
          }
          logRequest(200);
          return res.json({
            id: "chatcmpl-" + Date.now(),
            object: "chat.completion",
            created: Date.now(),
            model: model,
            choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]
          });
        }
      } else {
        // Tusk handling
        const response = await fetch(`${API_SOURCES.tusk}/api/v2/chat/conversations`, {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json", "User-Agent": USER_AGENT, "use-tusk-header": "true" },
          body: JSON.stringify({ role: "user", content: "Init", aiModelId: actualModel, chatAiModelType: "text" }),
        });
        if (!response.ok) throw new Error("Failed to create conversation");
        const convData = await response.json();
        
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

        const chatResponse = await fetch(`${API_SOURCES.tusk}/api/V2/Chat`, {
          method: "POST",
          headers: { "Accept": "application/x-ndjson", "Content-Type": "application/json", "User-Agent": USER_AGENT, "use-tusk-header": "true" },
          body: JSON.stringify(payload),
        });

        if (!chatResponse.ok) throw new Error(`HTTP ${chatResponse.status}`);
        if (!chatResponse.body) throw new Error("No response body");

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          
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
                    const chunkPayload = {
                      id: "chatcmpl-" + Date.now(),
                      object: "chat.completion.chunk",
                      created: Date.now(),
                      model: model,
                      choices: [{ index: 0, delta: { content: JSON.parse(data.content).content }, finish_reason: null }]
                    };
                    res.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
                  }
                } catch(e) {}
              }
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
          logRequest(200);
          return;
        } else {
          // Accumulate tusk stream
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
          logRequest(200);
          return res.json({
            id: "chatcmpl-" + Date.now(),
            object: "chat.completion",
            created: Date.now(),
            model: model,
            choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]
          });
        }
      }
    } catch (err: any) {
      logRequest(500);
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // Keep existing proxy routes for the playground frontend
  app.get("/api/providers", async (req, res) => {
    try {
      const apiSource = (req.query.apiSource as string) || "tusk";
      
      if (apiSource === "heck") {
        return res.json({
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
      
      const baseUrl = API_SOURCES[apiSource] || API_SOURCES.tusk;
      
      const response = await fetch(`${baseUrl}/api/v2/chat/providers`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": USER_AGENT,
          "use-tusk-header": "true",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching providers:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy conversations
  app.post("/api/conversations", async (req, res) => {
    try {
      const { modelId, apiSource = "tusk" } = req.body;
      
      if (apiSource === "heck") {
        return res.json({ chatId: apiSource + "-" + Date.now(), sessionId: apiSource + "-session" });
      }

      const baseUrl = API_SOURCES.tusk; // Force tusk for chat APIs

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
      res.json(data);
    } catch (err: any) {
      console.error("Error creating conversation:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy chat stream
  app.post("/api/chat", async (req, res) => {
    try {
      const { chatId, sessionId, modelId, prompt, tone = "technical", apiSource = "tusk" } = req.body;
      
      if (apiSource === "heck") {
        const response = await fetch("https://api.heckai.weight-wave.com/api/ha/v1/chat", {
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

        res.setHeader("Content-Type", "application/x-ndjson");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
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
              res.write(JSON.stringify(payload) + "\n");
            }
          }
        }
        res.end();
        return;
      }

      const baseUrl = API_SOURCES.tusk; // Force tusk for chat APIs
      
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
      
      if (!response.body) {
        throw new Error("No response body");
      }

      res.setHeader("Content-Type", "application/x-ndjson");
      
      // Node.js Web Streams to Express response
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err: any) {
      console.error("Error streaming chat:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();


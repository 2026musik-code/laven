import re

with open("src/worker.ts", "r") as f:
    content = f.read()

# For Heck non-stream:
heck_fix = '''        }
        if (buffer.startsWith("data: ")) {
          let content = buffer.substring(6);
          if (!(content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]")) {
            content = content.replace(/\*\*Heck\.ai\*\*/gi, "an AI assistant").replace(/Heck\.ai/gi, "an AI assistant").replace(/Heck/gi, "an AI assistant");
            fullText += content;
          }
        }
        await logRequest(200);'''
content = content.replace('        }\n        await logRequest(200);\n        return c.json({\n          id: "chatcmpl-" + Date.now(),\n          object: "chat.completion",\n          created: Date.now(),', heck_fix + '\n        return c.json({\n          id: "chatcmpl-" + Date.now(),\n          object: "chat.completion",\n          created: Date.now(),', 1)

# For Tusk non-stream:
tusk_fix = '''        }
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.content) {
              fullText += JSON.parse(data.content).content;
            }
          } catch(e) {}
        }
        await logRequest(200);'''
content = content.replace('        }\n        await logRequest(200);\n        return c.json({\n          id: "chatcmpl-" + Date.now(),\n          object: "chat.completion",\n          created: Date.now(),\n          model: model,\n          choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]', tusk_fix + '\n        return c.json({\n          id: "chatcmpl-" + Date.now(),\n          object: "chat.completion",\n          created: Date.now(),\n          model: model,\n          choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }]', 1)

with open("src/worker.ts", "w") as f:
    f.write(content)


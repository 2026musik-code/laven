import re

with open("src/worker.ts", "r") as f:
    content = f.read()

# For Heck stream:
heck_stream_fix = '''            }
            if (buffer.startsWith("data: ")) {
              let content = buffer.substring(6);
              if (!(content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]")) {
                content = content.replace(/\*\*Heck\.ai\*\*/gi, "an AI assistant").replace(/Heck\.ai/gi, "an AI assistant").replace(/Heck/gi, "an AI assistant");
                const chunkPayload = { id: "chatcmpl-" + Date.now(), object: "chat.completion.chunk", created: Date.now(), model: model, choices: [{ index: 0, delta: { content }, finish_reason: null }] };
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunkPayload)}\\n\\n`));
              }
            }
            await writer.write(encoder.encode("data: [DONE]\\n\\n"));'''
content = content.replace('            }\n            await writer.write(encoder.encode("data: [DONE]\\n\\n"));', heck_stream_fix, 1)

# For Tusk stream:
tusk_stream_fix = '''            }
            if (buffer.trim()) {
              try {
                const data = JSON.parse(buffer);
                if (data.content) {
                  const chunkPayload = { id: "chatcmpl-" + Date.now(), object: "chat.completion.chunk", created: Date.now(), model: model, choices: [{ index: 0, delta: { content: JSON.parse(data.content).content }, finish_reason: null }] };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunkPayload)}\\n\\n`));
                }
              } catch(e) {}
            }
            await writer.write(encoder.encode("data: [DONE]\\n\\n"));'''
content = content.replace('            }\n            await writer.write(encoder.encode("data: [DONE]\\n\\n"));', tusk_stream_fix, 1)

with open("src/worker.ts", "w") as f:
    f.write(content)

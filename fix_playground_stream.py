import re

with open("src/worker.ts", "r") as f:
    content = f.read()

# For Heck stream in /api/chat
heck_chat_fix = '''            }
            if (buffer.startsWith("data: ")) {
              let content = buffer.substring(6);
              if (!(content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]")) {
                const payload = { content: JSON.stringify({ content: content }) };
                await writer.write(encoder.encode(JSON.stringify(payload) + "\\n"));
              }
            }
          } finally {'''

content = content.replace('            }\n          }\n        } finally {', heck_chat_fix, 1)

with open("src/worker.ts", "w") as f:
    f.write(content)

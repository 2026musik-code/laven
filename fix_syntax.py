import re

with open("src/worker.ts", "r") as f:
    content = f.read()

# I will just replace the specific broken part in src/worker.ts around line 700

part = """            if (buffer.startsWith("data: ")) {
              let content = buffer.substring(6);
              if (!(content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]")) {
                const payload = { content: JSON.stringify({ content: content }) };
                await writer.write(encoder.encode(JSON.stringify(payload) + "\\n"));
              }
            }
          } finally {"""

fixed_part = """            }
          }
          if (buffer.startsWith("data: ")) {
            let content = buffer.substring(6);
            if (!(content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]")) {
              const payload = { content: JSON.stringify({ content: content }) };
              await writer.write(encoder.encode(JSON.stringify(payload) + "\\n"));
            }
          }
        } finally {"""

content = content.replace(part, fixed_part)

with open("src/worker.ts", "w") as f:
    f.write(content)

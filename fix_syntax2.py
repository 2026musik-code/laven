with open("src/worker.ts", "r") as f:
    content = f.read()

bad_part = """            for (const line of lines) {
              if (line.startsWith("data: ")) {
                let content = line.substring(6);
                if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") {
                   continue;
                }
                const payload = {
                  content: JSON.stringify({ content: content })
                };
                await writer.write(encoder.encode(JSON.stringify(payload) + "\\n"));
              }
            }
            }
          }
          if (buffer.startsWith("data: ")) {"""

good_part = """            for (const line of lines) {
              if (line.startsWith("data: ")) {
                let content = line.substring(6);
                if (content.trim() === "[REASON_START]" || content.trim() === "[REASON_DONE]" || content.trim() === "[ANSWER_START]" || content.trim() === "[ANSWER_DONE]" || content.trim() === "[RELATE_Q_START]" || content.trim() === "[RELATE_Q_DONE]") {
                   continue;
                }
                const payload = {
                  content: JSON.stringify({ content: content })
                };
                await writer.write(encoder.encode(JSON.stringify(payload) + "\\n"));
              }
            }
          }
          if (buffer.startsWith("data: ")) {"""

content = content.replace(bad_part, good_part)
with open("src/worker.ts", "w") as f:
    f.write(content)

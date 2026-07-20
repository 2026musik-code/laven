import re

with open("src/worker.ts", "r") as f:
    content = f.read()

def replacer(match):
    prefix = match.group(1) # Up to while (true) {
    read_and_break = match.group(2) # const { done, value }...
    
    # inject let buffer = ""; before while
    # we need to find the `while (true) {` in prefix
    
    parts = prefix.rsplit('while (true) {', 1)
    if len(parts) == 2:
        new_prefix = parts[0] + 'let buffer = "";\n' + ' ' * (len(prefix) - len(parts[0]) - 14) + 'while (true) {' + parts[1]
    else:
        # fallback
        new_prefix = prefix
        
    return new_prefix + read_and_break + """
""" + ' ' * 12 + """buffer += decoder.decode(value, { stream: true });
""" + ' ' * 12 + """const lines = buffer.split("\\n");
""" + ' ' * 12 + """buffer = lines.pop() || "";"""

pattern = re.compile(
    r'(const decoder = new TextDecoder\("utf-8"\);.*?)(const \{ done, value \} = await reader\.read\(\);\s*if \(done\) break;)\s*const chunk = decoder\.decode\(value, \{ stream: true \}\);\s*const lines = chunk\.split\("\\n"\);',
    re.DOTALL
)

new_content = pattern.sub(replacer, content)

with open("src/worker.ts", "w") as f:
    f.write(new_content)


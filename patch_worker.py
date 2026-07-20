import re

with open("src/worker.ts", "r") as f:
    content = f.read()

# 1. Update checkRateLimit
content = re.sub(
    r'async function checkRateLimit\(env: Bindings, token: string\) \{.*?const LIMIT = 100;.*?if \(count >= LIMIT\) \{',
    r'''async function checkRateLimit(env: Bindings, token: string, limit: number = 100) {
  // Fixed window rate limiting (per hour)
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
  const kvKey = `ratelimit:${token}:${currentHour}`;
  
  let count = parseInt(await env.lavenai.get(kvKey) || "0", 10);
  
  if (count >= limit) {''',
    content,
    flags=re.DOTALL
)

# 2. Update authenticate
content = re.sub(
    r'const isAllowed = await checkRateLimit\(c\.env, token\);\s*if \(!isAllowed\) \{\s*return \{ error: "Rate limit exceeded \(100 requests / hour\)", status: 429 \};\s*\}',
    r'''const limit = validKey.limit || 100;
  const isAllowed = await checkRateLimit(c.env, token, limit);
  if (!isAllowed) {
    return { error: `Rate limit exceeded (${limit} requests / hour)`, status: 429 };
  }
  
  // Update total usage
  c.executionCtx.waitUntil((async () => {
    let usage = parseInt(await c.env.lavenai.get(`usage:${token}`) || "0", 10);
    await c.env.lavenai.put(`usage:${token}`, (usage + 1).toString());
  })());''',
    content,
    flags=re.DOTALL
)

# 3. Update Admin Auth Middleware
content = re.sub(
    r'// Verify with environment variable\s*if \(!c\.env\.ADMIN_SECRET \|\| token !== c\.env\.ADMIN_SECRET\) \{',
    r'''// Verify with KV or environment variable
  const kvAdminSecret = await c.env.lavenai.get("adminSecret");
  const actualSecret = kvAdminSecret || c.env.ADMIN_SECRET;
  if (!actualSecret || token !== actualSecret) {''',
    content,
    flags=re.DOTALL
)

# 4. Add redeemCodes helper
helper_funcs = '''
async function getRedeemCodes(env: Bindings) {
  const str = await env.lavenai.get("redeemCodes");
  return str ? JSON.parse(str) : [];
}
async function saveRedeemCodes(env: Bindings, codes: any[]) {
  await env.lavenai.put("redeemCodes", JSON.stringify(codes));
}
'''
content = content.replace('// Admin API Keys Management', helper_funcs + '\n// Admin API Keys Management')

# 5. Update /api/admin/keys GET and POST, add change-token and codes
admin_routes = '''// Admin API Keys Management
app.get("/api/admin/keys", async (c) => {
  const keys = await getApiKeys(c.env);
  for (let key of keys) {
    key.requests = parseInt(await c.env.lavenai.get(`usage:${key.key}`) || "0", 10);
  }
  return c.json(keys);
});

app.post("/api/admin/keys", async (c) => {
  const body = await c.req.json();
  const keys = await getApiKeys(c.env);
  const newKey = {
    key: "sk-" + crypto.randomUUID().replace(/-/g, ""),
    name: body.name || "New Key",
    user: body.user || body.name || "Unknown",
    limit: body.limit || 100,
    createdAt: Date.now(),
  };
  keys.push(newKey);
  await saveApiKeys(c.env, keys);
  return c.json(newKey);
});

app.post("/api/admin/change-token", async (c) => {
  const body = await c.req.json();
  if (body.newToken) {
    await c.env.lavenai.put("adminSecret", body.newToken);
    return c.json({ success: true });
  }
  return c.json({ error: "Missing newToken" }, 400);
});

app.get("/api/admin/codes", async (c) => {
  const codes = await getRedeemCodes(c.env);
  return c.json(codes);
});

app.post("/api/admin/codes", async (c) => {
  const body = await c.req.json();
  const codes = await getRedeemCodes(c.env);
  const newCode = {
    code: body.code || "LAVEN-" + crypto.randomUUID().split("-")[0].toUpperCase().substring(0, 8),
    limit: body.limit || 100,
    used: false,
    createdAt: Date.now()
  };
  codes.push(newCode);
  await saveRedeemCodes(c.env, codes);
  return c.json(newCode);
});

app.delete("/api/admin/codes/:code", async (c) => {
  const codeToRemove = c.req.param("code");
  const codes = await getRedeemCodes(c.env);
  const index = codes.findIndex((k: any) => k.code === codeToRemove);
  if (index !== -1) {
    codes.splice(index, 1);
    await saveRedeemCodes(c.env, codes);
    return c.json({ success: true });
  }
  return c.json({ error: "Code not found" }, 404);
});'''

content = re.sub(
    r'// Admin API Keys Management\s*app\.get\("/api/admin/keys".*?app\.post\("/api/admin/keys".*?return c\.json\(newKey\);\s*\}\);',
    admin_routes,
    content,
    flags=re.DOTALL
)

# 6. Add /api/redeem
redeem_route = '''
app.post("/api/redeem", async (c) => {
  const body = await c.req.json();
  const { code, user } = body;
  if (!code || !user) return c.json({ error: "Missing code or user" }, 400);
  
  const codes = await getRedeemCodes(c.env);
  const codeIndex = codes.findIndex((k: any) => k.code === code);
  
  if (codeIndex === -1) return c.json({ error: "Invalid code" }, 400);
  if (codes[codeIndex].used) return c.json({ error: "Code already used" }, 400);
  
  codes[codeIndex].used = true;
  codes[codeIndex].usedBy = user;
  codes[codeIndex].usedAt = Date.now();
  await saveRedeemCodes(c.env, codes);
  
  const keys = await getApiKeys(c.env);
  const newKey = {
    key: "sk-" + crypto.randomUUID().replace(/-/g, ""),
    name: user,
    user: user,
    limit: codes[codeIndex].limit || 100,
    createdAt: Date.now(),
  };
  keys.push(newKey);
  await saveApiKeys(c.env, keys);
  
  return c.json(newKey);
});

// Admin Logs
'''

content = re.sub(r'// Admin Logs', redeem_route, content)

with open("src/worker.ts", "w") as f:
    f.write(content)

import re

with open("src/worker.ts", "r") as f:
    content = f.read()

bindings = """type Bindings = {
  lavenai: any; // KVNamespace
  ADMIN_SECRET: string;
  ASSETS: any; // Fetcher
};"""
content = re.sub(r'type Bindings = \{.*?ADMIN_SECRET: string;\s*\}', bindings, content, flags=re.DOTALL)

spa_fallback = """
// Fallback for SPA routing (React)
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/v1/")) {
    return c.json({ error: "Not found" }, 404);
  }
  // Serve the index.html for any other route
  try {
    const url = new URL(c.req.url);
    url.pathname = "/";
    return await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
  } catch (err) {
    return c.text("Not found", 404);
  }
});

export default app;"""
content = content.replace("export default app;", spa_fallback)

with open("src/worker.ts", "w") as f:
    f.write(content)

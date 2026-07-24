import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  let activeClient: Client | null = null;
  let activeTransport: any = null;
  let currentServerUrl: string | null = null;
  let lastConnectError: string | null = null;

  // Endpoint: Check status
  app.get("/api/mcp/status", async (req, res) => {
    try {
      if (!activeClient) {
        return res.json({
          connected: false,
          serverUrl: currentServerUrl,
          error: lastConnectError,
        });
      }

      const tools = await activeClient.listTools().catch(() => ({ tools: [] }));
      const resources = await activeClient.listResources().catch(() => ({ resources: [] }));
      const prompts = await activeClient.listPrompts().catch(() => ({ prompts: [] }));

      res.json({
        connected: true,
        serverUrl: currentServerUrl,
        serverVersion: activeClient.getServerVersion?.(),
        tools: tools.tools || [],
        resources: resources.resources || [],
        prompts: prompts.prompts || [],
      });
    } catch (err: any) {
      res.json({
        connected: false,
        serverUrl: currentServerUrl,
        error: err.message || "Failed to query server status",
      });
    }
  });

  // Endpoint: Connect to MCP endpoint
  app.post("/api/mcp/connect", async (req, res) => {
    const targetUrl = req.body.url || "https://mcp-ssh.jatnikonm.tech/mcp";

    try {
      if (activeTransport) {
        try {
          await activeTransport.close();
        } catch (_) {}
        activeClient = null;
        activeTransport = null;
      }

      currentServerUrl = targetUrl;
      lastConnectError = null;

      const urlObj = new URL(targetUrl);
      const attempts: Array<{ type: "streamable" | "sse"; url: URL }> = [];

      if (urlObj.pathname.endsWith("/sse")) {
        attempts.push({ type: "sse", url: urlObj });
        attempts.push({ type: "streamable", url: urlObj });
        const altUrl = new URL(urlObj.href);
        altUrl.pathname = altUrl.pathname.replace(/\/sse$/, "/mcp");
        attempts.push({ type: "streamable", url: altUrl });
      } else {
        attempts.push({ type: "streamable", url: urlObj });
        attempts.push({ type: "sse", url: urlObj });
        const altUrl = new URL(urlObj.href);
        if (altUrl.pathname.endsWith("/mcp")) {
          altUrl.pathname = altUrl.pathname.replace(/\/mcp$/, "/sse");
          attempts.push({ type: "sse", url: altUrl });
        }
      }

      let connectedClient: Client | null = null;
      let connectedTransport: any = null;
      let lastErr: any = null;

      for (const attempt of attempts) {
        const client = new Client(
          {
            name: "mcp-web-client",
            version: "1.0.0",
          },
          {
            capabilities: {
              prompts: {},
              resources: {},
              tools: {},
            },
          }
        );

        let transport: any;
        if (attempt.type === "streamable") {
          transport = new StreamableHTTPClientTransport(attempt.url, {
            requestInit: {
              headers: {
                "Accept": "application/json, text/event-stream",
              },
            },
          });
        } else {
          transport = new SSEClientTransport(attempt.url, {
            requestInit: {
              headers: { "Accept": "application/json, text/event-stream" },
            },
            eventSourceInit: {
              headers: { "Accept": "text/event-stream, application/json" },
            },
          });
        }

        try {
          const connectPromise = client.connect(transport);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout connecting via ${attempt.type}`)), 8000)
          );
          await Promise.race([connectPromise, timeoutPromise]);
          connectedClient = client;
          connectedTransport = transport;
          currentServerUrl = attempt.url.href;
          break;
        } catch (err: any) {
          console.warn(`Attempt failed (${attempt.type} on ${attempt.url.href}):`, err.message);
          lastErr = err;
          try {
            await transport.close();
          } catch (_) {}
        }
      }

      if (!connectedClient || !connectedTransport) {
        throw lastErr || new Error("All connection attempts failed");
      }

      activeClient = connectedClient;
      activeTransport = connectedTransport;

      const toolsRes = await activeClient.listTools().catch(() => ({ tools: [] }));
      const resourcesRes = await activeClient.listResources().catch(() => ({ resources: [] }));
      const promptsRes = await activeClient.listPrompts().catch(() => ({ prompts: [] }));

      return res.json({
        success: true,
        connected: true,
        serverUrl: currentServerUrl,
        serverVersion: activeClient.getServerVersion?.(),
        tools: toolsRes.tools || [],
        resources: resourcesRes.resources || [],
        prompts: promptsRes.prompts || [],
      });
    } catch (err: any) {
      lastConnectError = err.message || String(err);
      activeClient = null;
      activeTransport = null;
      return res.status(500).json({
        success: false,
        connected: false,
        error: lastConnectError,
      });
    }
  });

  // Endpoint: Disconnect
  app.post("/api/mcp/disconnect", async (req, res) => {
    try {
      if (activeTransport) {
        await activeTransport.close();
      }
    } catch (_) {}
    activeClient = null;
    activeTransport = null;
    currentServerUrl = null;
    lastConnectError = null;
    res.json({ success: true, connected: false });
  });

  // Endpoint: Call Tool
  app.post("/api/mcp/call-tool", async (req, res) => {
    if (!activeClient) {
      return res.status(400).json({ error: "No active MCP connection" });
    }

    const { name, arguments: args } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tool name is required" });
    }

    try {
      const result = await activeClient.callTool({
        name,
        arguments: args || {},
      });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Endpoint: Read Resource
  app.post("/api/mcp/read-resource", async (req, res) => {
    if (!activeClient) {
      return res.status(400).json({ error: "No active MCP connection" });
    }

    const { uri } = req.body;
    if (!uri) {
      return res.status(400).json({ error: "Resource URI is required" });
    }

    try {
      const result = await activeClient.readResource({ uri });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Endpoint: Get Prompt
  app.post("/api/mcp/get-prompt", async (req, res) => {
    if (!activeClient) {
      return res.status(400).json({ error: "No active MCP connection" });
    }

    const { name, arguments: args } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Prompt name is required" });
    }

    try {
      const result = await activeClient.getPrompt({
        name,
        arguments: args || {},
      });
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Vite middleware for dev or static serving for prod
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

#!/usr/bin/env tsx
import { Command } from "commander";
import pc from "picocolors";

const program = new Command();
const API_BASE = "http://localhost:3000/api/mcp";

program
  .name("mcp-cli")
  .description("CLI to manage the local MCP Dashboard connection")
  .version("1.0.0");

async function fetchApi(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error(pc.red(`Error connecting to dashboard API: ${err.message}`));
    console.log(pc.yellow("Make sure the dashboard server is running (npm run dev) on port 3000."));
    process.exit(1);
  }
}

program
  .command("status")
  .description("Get current MCP connection status")
  .action(async () => {
    const data = await fetchApi("/status");
    if (data.connected) {
      console.log(pc.green("✓ Connected"));
      console.log(`Server URL: ${pc.cyan(data.serverUrl)}`);
      if (data.serverVersion) {
        console.log(`Version: ${data.serverVersion.name} v${data.serverVersion.version}`);
      }
      console.log(pc.gray(`Available: ${data.tools?.length || 0} tools, ${data.resources?.length || 0} resources, ${data.prompts?.length || 0} prompts`));
    } else {
      console.log(pc.red("✗ Disconnected"));
      if (data.error) {
        console.log(`Last Error: ${pc.red(data.error)}`);
      }
    }
  });

program
  .command("connect <url>")
  .description("Connect to an MCP server")
  .action(async (url) => {
    console.log(pc.cyan(`Connecting to ${url}...`));
    const data = await fetchApi("/connect", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    if (data.success) {
      console.log(pc.green("✓ Successfully connected"));
      console.log(`Found ${data.tools?.length || 0} tools.`);
    } else {
      console.log(pc.red(`✗ Failed to connect: ${data.error}`));
    }
  });

program
  .command("disconnect")
  .description("Disconnect from current MCP server")
  .action(async () => {
    const data = await fetchApi("/disconnect", { method: "POST" });
    if (data.success) {
      console.log(pc.green("✓ Disconnected"));
    }
  });

program
  .command("tools")
  .description("List available tools")
  .action(async () => {
    const data = await fetchApi("/status");
    if (!data.connected) {
      console.log(pc.red("Not connected to any MCP server."));
      return;
    }
    const tools = data.tools || [];
    if (tools.length === 0) {
      console.log(pc.yellow("No tools available."));
      return;
    }
    console.log(pc.bold("\nAvailable Tools:"));
    tools.forEach((t: any) => {
      console.log(`\n- ${pc.green(t.name)}: ${t.description || "No description"}`);
      if (t.inputSchema) {
        console.log(pc.gray(`  Schema: ${JSON.stringify(t.inputSchema)}`));
      }
    });
  });

program
  .command("call <name> [args...]")
  .description("Call an MCP tool with JSON arguments")
  .action(async (name, argsArray) => {
    let argsObj = {};
    if (argsArray.length > 0) {
      try {
        argsObj = JSON.parse(argsArray.join(" "));
      } catch (e) {
        console.error(pc.red("Invalid JSON arguments provided. Please provide a valid JSON string."));
        console.log(pc.gray(`Example: mcp-cli call myTool '{"param":"value"}'`));
        return;
      }
    }
    
    console.log(pc.cyan(`Calling tool '${name}'...`));
    const data = await fetchApi("/call-tool", {
      method: "POST",
      body: JSON.stringify({ name, arguments: argsObj }),
    });
    
    if (data.success) {
      console.log(pc.green("✓ Success\n"));
      console.log(JSON.stringify(data.result, null, 2));
    } else {
      console.log(pc.red(`✗ Error: ${data.error}`));
    }
  });

program.parse(process.argv);

import React, { useState, useEffect } from "react";
import {
  Terminal,
  Server,
  Play,
  RefreshCw,
  Zap,
  FolderTree,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  Globe,
  Sliders,
  Send,
  Trash2,
  Copy,
  ChevronRight,
  Database,
  Search,
  Check,
  Eye,
  Info,
  Wrench,
  AlignLeft
} from "lucide-react";

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: any[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "request" | "response" | "error";
  title: string;
  data?: any;
}

const CLOUDFLARE_SANDBOX_CONTAINER_TOOLS: MCPTool[] = [
  {
    name: "container_initialize",
    description: "(Re)start a container. Containers are intended to be ephemeral and don't save any state. Containers are only guaranteed to last ~10m.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "container_ping",
    description: "Ping a container for connectivity",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "container_file_write",
    description: "Write to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Target file path relative to workdir"
        },
        text: {
          type: "string",
          description: "Full text content of the file you want to write."
        }
      },
      required: ["path", "text"]
    }
  },
  {
    name: "container_files_list",
    description: "List all files in the work directory",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "container_file_read",
    description: "Read the contents of a single file or directory",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Target file or directory path relative to workdir"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "container_file_delete",
    description: "Delete a single file or directory",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Target file or directory path relative to workdir"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "container_exec",
    description: "Run a command in the shell",
    inputSchema: {
      type: "object",
      properties: {
        args: {
          type: "string",
          description: "Shell command string to run inside the sandbox container"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds"
        },
        streamStderr: {
          type: "boolean",
          default: true,
          description: "Whether to stream stderr output"
        }
      },
      required: ["args"]
    }
  }
];

const PRESET_SERVERS = [
  { name: "SSH MCP Server", url: "https://mcp-ssh.jatnikonm.tech/mcp" },
  { name: "Containers MCP Server", url: "https://mcp-containers.jatnikonm.tech/mcp" },
  { name: "Containers SSE Endpoint", url: "https://mcp-containers.jatnikonm.tech/sse" },
  { name: "Cloudflare Sandbox Container", url: "https://containers.mcp.cloudflare.com/mcp" },
];

export default function App() {
  const [serverUrl, setServerUrl] = useState("https://mcp-ssh.jatnikonm.tech/mcp");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [prompts, setPrompts] = useState<MCPPrompt[]>([]);
  const [serverVersion, setServerVersion] = useState<any>(null);

  const [toolSearch, setToolSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [callingTool, setCallingTool] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);

  const [selectedResource, setSelectedResource] = useState<MCPResource | null>(null);
  const [readingResource, setReadingResource] = useState(false);
  const [resourceData, setResourceData] = useState<any>(null);

  const [selectedPrompt, setSelectedPrompt] = useState<MCPPrompt | null>(null);
  const [promptArgs, setPromptArgs] = useState<string>("{}");
  const [fetchingPrompt, setFetchingPrompt] = useState(false);
  const [promptData, setPromptData] = useState<any>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"tools" | "resources" | "prompts" | "logs">("tools");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const addLog = (type: LogEntry["type"], title: string, data?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      title,
      data,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 49)]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/mcp/status");
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        if (data.serverUrl) setServerUrl(data.serverUrl);
        setTools(data.tools || []);
        setResources(data.resources || []);
        setPrompts(data.prompts || []);
        setServerVersion(data.serverVersion || null);
        if (data.tools && data.tools.length > 0 && !selectedTool) {
          setSelectedTool(data.tools[0]);
          setupDefaultArgs(data.tools[0]);
        }
        return true;
      } else {
        setConnected(false);
        if (data.error) setError(data.error);
        return false;
      }
    } catch (err: any) {
      console.error(err);
      return false;
    }
  };

  const loadCloudflareTools = () => {
    setTools(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS);
    setSelectedTool(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS[0]);
    setupDefaultArgs(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS[0]);
    setConnected(true);
    setServerUrl("https://containers.mcp.cloudflare.com/mcp");
    setError(null);
    addLog("info", "Loaded Cloudflare Sandbox Container Tools schema (apps/sandbox-container)");
  };

  const handleConnect = async (urlToConnect?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetUrl = urlToConnect || serverUrl;
    setServerUrl(targetUrl);
    setConnecting(true);
    setError(null);
    addLog("info", `Initiating MCP connection to ${targetUrl}`);

    if (targetUrl.includes("cloudflare.com")) {
      // Direct Cloudflare URL requested - attempt connection
    }

    try {
      const res = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setConnected(true);
        setTools(data.tools || []);
        setResources(data.resources || []);
        setPrompts(data.prompts || []);
        setServerVersion(data.serverVersion || null);
        setError(null);

        addLog("info", `Successfully connected to MCP Server`, {
          version: data.serverVersion,
          toolsCount: data.tools?.length || 0,
          resourcesCount: data.resources?.length || 0,
          promptsCount: data.prompts?.length || 0,
        });

        if (data.tools && data.tools.length > 0) {
          setSelectedTool(data.tools[0]);
          setupDefaultArgs(data.tools[0]);
        } else {
          setSelectedTool(null);
        }
      } else {
        setConnected(false);
        const errMsg = data.error || "Connection failed";
        
        if (targetUrl.includes("cloudflare.com")) {
          // If Cloudflare endpoint returned 401 OAuth required, load Cloudflare tool schemas
          setError(`${errMsg} — Official hosted endpoint require OAuth token authentication. Loaded official schema from github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/sandbox-container below.`);
          setTools(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS);
          if (CLOUDFLARE_SANDBOX_CONTAINER_TOOLS.length > 0) {
            setSelectedTool(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS[0]);
            setupDefaultArgs(CLOUDFLARE_SANDBOX_CONTAINER_TOOLS[0]);
          }
          addLog("error", `Cloudflare OAuth required (401)`, errMsg);
        } else {
          setError(errMsg);
          addLog("error", `Connection failed`, errMsg);
        }
      }
    } catch (err: any) {
      setConnected(false);
      const msg = err.message || "Failed to reach backend server";
      setError(msg);
      addLog("error", `Network Error`, msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/mcp/disconnect", { method: "POST" });
      setConnected(false);
      setTools([]);
      setResources([]);
      setPrompts([]);
      setSelectedTool(null);
      setToolResult(null);
      setSelectedResource(null);
      setResourceData(null);
      setSelectedPrompt(null);
      setPromptData(null);
      addLog("info", `Disconnected from MCP Server`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const setupDefaultArgs = (tool: MCPTool) => {
    if (tool.inputSchema?.properties) {
      const initialArgs: Record<string, any> = {};
      Object.entries(tool.inputSchema.properties).forEach(([key, val]: [string, any]) => {
        if (val.type === "string") initialArgs[key] = val.default || "";
        else if (val.type === "number" || val.type === "integer") initialArgs[key] = val.default || 0;
        else if (val.type === "boolean") initialArgs[key] = val.default || false;
        else if (val.type === "object") initialArgs[key] = val.default || {};
        else if (val.type === "array") initialArgs[key] = val.default || [];
        else initialArgs[key] = val.default || "";
      });
      setToolArgs(JSON.stringify(initialArgs, null, 2));
    } else {
      setToolArgs("{}");
    }
  };

  const formatJsonArgs = () => {
    try {
      const parsed = JSON.parse(toolArgs);
      setToolArgs(JSON.stringify(parsed, null, 2));
    } catch (err) {
      setError("Invalid JSON format");
    }
  };

  const handleSelectTool = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolResult(null);
    setupDefaultArgs(tool);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;
    setCallingTool(true);
    setToolResult(null);

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolArgs);
    } catch (err) {
      setError("Invalid JSON parameters format");
      setCallingTool(false);
      return;
    }

    addLog("request", `Call tool: ${selectedTool.name}`, parsedArgs);

    try {
      const res = await fetch("/api/mcp/call-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedTool.name,
          arguments: parsedArgs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToolResult(data.result);
        addLog("response", `Tool call succeeded: ${selectedTool.name}`, data.result);
      } else {
        setToolResult({ error: data.error });
        addLog("error", `Tool call failed: ${selectedTool.name}`, data.error);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to execute tool";
      setToolResult({ error: msg });
      addLog("error", `Tool call execution error`, msg);
    } finally {
      setCallingTool(false);
    }
  };

  const handleReadResource = async (resItem: MCPResource) => {
    setSelectedResource(resItem);
    setReadingResource(true);
    setResourceData(null);
    addLog("request", `Read resource: ${resItem.uri}`);

    try {
      const res = await fetch("/api/mcp/read-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: resItem.uri }),
      });

      const data = await res.json();
      if (data.success) {
        setResourceData(data.result);
        addLog("response", `Read resource succeeded: ${resItem.uri}`, data.result);
      } else {
        setResourceData({ error: data.error });
        addLog("error", `Read resource failed: ${resItem.uri}`, data.error);
      }
    } catch (err: any) {
      setResourceData({ error: err.message || "Failed to read resource" });
      addLog("error", `Read resource exception`, err.message);
    } finally {
      setReadingResource(false);
    }
  };

  const handleGetPrompt = async (promptItem: MCPPrompt) => {
    setSelectedPrompt(promptItem);
    setFetchingPrompt(true);
    setPromptData(null);

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(promptArgs);
    } catch (e) {
      parsedArgs = {};
    }

    addLog("request", `Get prompt: ${promptItem.name}`, parsedArgs);

    try {
      const res = await fetch("/api/mcp/get-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: promptItem.name,
          arguments: parsedArgs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPromptData(data.result);
        addLog("response", `Get prompt succeeded: ${promptItem.name}`, data.result);
      } else {
        setPromptData({ error: data.error });
        addLog("error", `Get prompt failed: ${promptItem.name}`, data.error);
      }
    } catch (err: any) {
      setPromptData({ error: err.message || "Failed to fetch prompt" });
      addLog("error", `Get prompt exception`, err.message);
    } finally {
      setFetchingPrompt(false);
    }
  };

  useEffect(() => {
    checkStatus().then((alreadyConnected) => {
      if (!alreadyConnected) {
        handleConnect("https://mcp-ssh.jatnikonm.tech/mcp");
      }
    });
  }, []);

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(toolSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Bar Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-tight text-white">MCP Connection Dashboard</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v1.29.0 SDK
              </span>
            </div>
            <p className="text-xs text-slate-400">Model Context Protocol Client Inspector</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-3">
          {connected ? (
            <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Connected to MCP Server</span>
            </div>
          ) : connecting ? (
            <div className="flex items-center space-x-2 bg-amber-500/10 text-amber-400 text-xs px-3 py-1.5 rounded-full border border-amber-500/20 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Disconnected</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Connection Form & Presets Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
          <form onSubmit={(e) => handleConnect(undefined, e)} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://mcp-ssh.jatnikonm.tech/mcp"
                className="w-full bg-slate-950 text-slate-100 text-sm rounded-lg pl-10 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
              />
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Connect Endpoint</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 font-medium mr-1">Quick Connect:</span>
            {PRESET_SERVERS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => handleConnect(preset.url)}
                disabled={connecting}
                className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-all cursor-pointer ${
                  serverUrl === preset.url && connected
                    ? "bg-indigo-950/80 border-indigo-500 text-indigo-300 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={loadCloudflareTools}
              className="px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 text-xs font-mono transition-all cursor-pointer flex items-center space-x-1"
            >
              <Wrench className="w-3 h-3 text-amber-400" />
              <span>Load Cloudflare Sandbox Schema</span>
            </button>
          </div>

          {/* Connection Error Banner */}
          {error && (
            <div className="mt-2 p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-start space-x-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Connection Exception</p>
                <p className="mt-0.5 font-mono text-[11px] leading-relaxed opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Connected Details Grid */}
          {connected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-medium">Active Protocol</span>
                <span className="text-sm font-semibold text-indigo-400 font-mono mt-0.5 block">Streamable HTTP / SSE</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-medium">Tools Exported</span>
                <span className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 block">{tools.length}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-medium">Resources</span>
                <span className="text-sm font-semibold text-sky-400 font-mono mt-0.5 block">{resources.length}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block font-medium">Prompts</span>
                <span className="text-sm font-semibold text-purple-400 font-mono mt-0.5 block">{prompts.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("tools")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === "tools"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Tools</span>
            {tools.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{tools.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("resources")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === "resources"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Resources</span>
            {resources.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{resources.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === "prompts"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Prompts</span>
            {prompts.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{prompts.length}</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === "logs"
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>JSON-RPC Logs</span>
            {logs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{logs.length}</span>
            )}
          </button>
        </div>

        {/* Tab Content: Tools */}
        {activeTab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tool List Sidebar */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Discovered MCP Tools ({filteredTools.length})
                </h3>
              </div>

              {/* Search input */}
              {tools.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Search tools..."
                    className="w-full bg-slate-950 text-xs text-slate-200 pl-8 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {filteredTools.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {connected
                    ? toolSearch
                      ? "No matching tools found"
                      : "No tools exported by server"
                    : "Connect to MCP server to discover tools"}
                </div>
              ) : (
                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {filteredTools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedTool?.name === tool.name
                          ? "bg-indigo-950/60 border-indigo-500/50 text-indigo-200 shadow-sm"
                          : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-white">{tool.name}</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      </div>
                      {tool.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">{tool.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tool Executor / Inspector Panel */}
            <div className="lg:col-span-8 space-y-4">
              {selectedTool ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
                  <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-base font-semibold text-white font-mono">{selectedTool.name}</h2>
                      </div>
                      {selectedTool.description && (
                        <p className="text-xs text-slate-300 mt-1">{selectedTool.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-1 bg-slate-800 text-indigo-300 rounded border border-slate-700 shrink-0">
                      Tool Execution
                    </span>
                  </div>

                  {/* Schema Summary Table */}
                  {selectedTool.inputSchema?.properties && (
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/80 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Input Schema Definitions
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {Object.entries(selectedTool.inputSchema.properties).map(([propName, propObj]: [string, any]) => {
                          const isRequired = selectedTool.inputSchema.required?.includes(propName);
                          return (
                            <div key={propName} className="flex flex-wrap items-center justify-between text-xs py-1 border-b border-slate-900 last:border-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-indigo-300 font-medium">{propName}</span>
                                {isRequired && (
                                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                                    required
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-slate-500">({propObj.type || "any"})</span>
                              </div>
                              {propObj.description && (
                                <span className="text-[11px] text-slate-400 truncate max-w-xs">{propObj.description}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Arguments Form */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                      <label className="flex items-center space-x-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Parameters (JSON format)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={formatJsonArgs}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 cursor-pointer"
                        >
                          <AlignLeft className="w-3 h-3" />
                          <span>Format JSON</span>
                        </button>
                        <button
                          onClick={() => setupDefaultArgs(selectedTool)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={7}
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                      className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  {/* Run Button */}
                  <button
                    onClick={handleExecuteTool}
                    disabled={callingTool || !connected}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {callingTool ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Tool...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Execute {selectedTool.name}</span>
                      </>
                    )}
                  </button>

                  {/* Output Result Viewer */}
                  {toolResult && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                          Execution Response
                        </span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(toolResult, null, 2), "tool-result")}
                          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedIndex === "tool-result" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Result</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-96 leading-relaxed">
                        {JSON.stringify(toolResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 space-y-2">
                  <Sliders className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">Select an exported tool from the sidebar to inspect parameters and invoke standard MCP calls.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Resources */}
        {activeTab === "resources" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Available Resources</h3>
            {resources.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No resources published by this MCP server endpoint.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((resItem, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-indigo-400">
                        <Database className="w-4 h-4 shrink-0" />
                        <span className="font-mono text-xs font-medium text-white truncate">{resItem.uri}</span>
                      </div>
                      {resItem.name && <p className="text-xs font-medium text-slate-300">{resItem.name}</p>}
                      {resItem.description && <p className="text-xs text-slate-400">{resItem.description}</p>}
                    </div>

                    <button
                      onClick={() => handleReadResource(resItem)}
                      disabled={readingResource && selectedResource?.uri === resItem.uri}
                      className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
                    >
                      {readingResource && selectedResource?.uri === resItem.uri ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Read Resource Content</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Resource Viewer Modal/Panel */}
            {selectedResource && resourceData && (
              <div className="mt-6 p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono text-xs font-semibold text-indigo-300">
                    Resource: {selectedResource.uri}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedResource(null);
                      setResourceData(null);
                    }}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <pre className="font-mono text-xs text-slate-200 overflow-x-auto max-h-96 leading-relaxed p-2">
                  {JSON.stringify(resourceData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Prompts */}
        {activeTab === "prompts" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Available Prompts</h3>
            {prompts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No prompt templates published by this MCP server endpoint.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prompts.map((p, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-purple-400">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="font-mono text-xs font-medium text-white">{p.name}</span>
                      </div>
                      {p.description && <p className="text-xs text-slate-400">{p.description}</p>}
                    </div>

                    <button
                      onClick={() => handleGetPrompt(p)}
                      disabled={fetchingPrompt && selectedPrompt?.name === p.name}
                      className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
                    >
                      {fetchingPrompt && selectedPrompt?.name === p.name ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Prompt...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Get Prompt Template</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Viewer Panel */}
            {selectedPrompt && promptData && (
              <div className="mt-6 p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono text-xs font-semibold text-purple-300">
                    Prompt Result: {selectedPrompt.name}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPrompt(null);
                      setPromptData(null);
                    }}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <pre className="font-mono text-xs text-slate-200 overflow-x-auto max-h-96 leading-relaxed p-2">
                  {JSON.stringify(promptData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: JSON-RPC Logs */}
        {activeTab === "logs" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Live Activity & RPC Logs</h3>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No RPC log events captured yet.</div>
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 font-mono text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {log.type === "info" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {log.type === "request" && <Send className="w-3.5 h-3.5 text-indigo-400" />}
                        {log.type === "response" && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                        {log.type === "error" && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                        <span className="font-medium text-slate-200">{log.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{log.timestamp}</span>
                      </span>
                    </div>

                    {log.data && (
                      <pre className="bg-slate-900/80 p-2.5 rounded border border-slate-800/60 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                        {typeof log.data === "string" ? log.data : JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

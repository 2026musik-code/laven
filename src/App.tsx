import React, { useState, useEffect } from "react";
import { Terminal, Key, Activity, Send, Check, Copy, Code, Database, Menu, X, Plus, Trash2, Zap, Settings, Shield, Sparkles, ChevronDown } from "lucide-react";

type Provider = {
  providerName: string;
  key: string;
  displayName: string;
  isPremium: boolean;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"testing" | "keys" | "logs">("testing");
  const [apiSource, setApiSource] = useState<"tusk" | "heck">("tusk");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  
  // Test interface state
  const [systemPrompt, setSystemPrompt] = useState("You are a highly capable AI assistant.");
  const [userPrompt, setUserPrompt] = useState("Hello! Write a short greeting.");
  const [streamResponse, setStreamResponse] = useState(false);
  const [testResponse, setTestResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // API Keys state
  const [adminSecret, setAdminSecret] = useState<string>(() => localStorage.getItem("adminSecret") || "");
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("adminSecret", adminSecret);
  }, [adminSecret]);
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Model Selection state
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [pingStatuses, setPingStatuses] = useState<Record<string, 'testing' | 'success' | 'error'>>({});

  const pingModel = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    setPingStatuses(prev => ({ ...prev, [modelId]: 'testing' }));
    try {
      const keyToUse = apiKeys.length > 0 ? apiKeys[0].key : "sk-default-key-for-testing";
      const modelTarget = `laven-${apiSource}/${modelId}`;
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyToUse}`
        },
        body: JSON.stringify({
          model: modelTarget,
          messages: [{ role: "user", content: "ping" }],
          stream: false
        })
      });
      if (res.ok) {
        setPingStatuses(prev => ({ ...prev, [modelId]: 'success' }));
      } else {
        setPingStatuses(prev => ({ ...prev, [modelId]: 'error' }));
      }
    } catch (err) {
      setPingStatuses(prev => ({ ...prev, [modelId]: 'error' }));
    }
  };

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "testing") {
      fetchProviders();
      fetchApiKeys(); // Needed to use a key for testing
    } else if (activeTab === "keys") {
      fetchApiKeys();
    } else if (activeTab === "logs") {
      fetchLogs();
    }
  }, [apiSource, activeTab]);

  const fetchProviders = async () => {
    try {
      const res = await fetch(`/api/providers?apiSource=${apiSource}`);
      const data = await res.json();
      const list = data.providers || [];
      setProviders(list);
      if (list.length > 0) {
        setSelectedModelId(list[0].key);
      }
    } catch (err) {
      console.error("Failed to fetch providers", err);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/admin/keys", {
        headers: { "Authorization": `Bearer ${adminSecret}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (e) {}
  };

  const generateKey = async () => {
    if (!newKeyName) return;
    await fetch("/api/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminSecret}` },
      body: JSON.stringify({ name: newKeyName })
    });
    setNewKeyName("");
    fetchApiKeys();
  };

  const deleteKey = async (key: string) => {
    await fetch(`/api/admin/keys/${key}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminSecret}` }
    });
    fetchApiKeys();
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs", {
        headers: { "Authorization": `Bearer ${adminSecret}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {}
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runTest = async () => {
    if (!selectedModelId) return;
    
    // Attempt to get a valid key to run the test
    const keyToUse = apiKeys.length > 0 ? apiKeys[0].key : "sk-default-key-for-testing";
    
    setTestLoading(true);
    setTestResponse("");
    setTestLatency(null);
    const start = Date.now();
    
    // Standard model mapping prefix
    const modelTarget = `laven-${apiSource}/${selectedModelId}`;

    const payload = {
      model: modelTarget,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: streamResponse
    };

    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyToUse}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        setTestResponse(`Error HTTP ${res.status}: ${err}`);
        setTestLoading(false);
        return;
      }

      if (streamResponse) {
        if (!res.body) throw new Error("No body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (let line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.substring(6));
                const content = data.choices[0]?.delta?.content || "";
                setTestResponse((prev) => prev + content);
              } catch (e) {}
            }
          }
        }
      } else {
        const data = await res.json();
        setTestResponse(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setTestResponse(`Exception: ${err.message}`);
    } finally {
      setTestLatency(Date.now() - start);
      setTestLoading(false);
    }
  };

  const curlCommand = `curl -X POST ${window.location.origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${API_KEY}" \\
  -d '{
    "model": "laven-${apiSource}/${selectedModelId || 'model-name'}",
    "messages": [
      {"role": "system", "content": "${systemPrompt.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"},
      {"role": "user", "content": "${userPrompt.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"}
    ],
    "stream": ${streamResponse}
  }'`;

  return (
    <div className="flex h-screen w-full bg-animated-pink text-gray-900 font-sans overflow-hidden relative selection:bg-pink-300/50">
      
      {/* Background Graphic Effects */}
      <div className="blob w-[600px] h-[600px] bg-white/40 rounded-full top-[-100px] left-[-100px]" style={{ animationDelay: "0s" }}></div>
      <div className="blob w-[500px] h-[500px] bg-pink-200/50 rounded-full bottom-[-50px] right-[-50px]" style={{ animationDelay: "-3s", animationDuration: "12s" }}></div>
      <div className="blob w-[400px] h-[400px] bg-rose-200/40 rounded-full top-[30%] left-[40%]" style={{ animationDelay: "-6s", animationDuration: "15s" }}></div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-pink-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 z-50 w-64 bg-white/60 backdrop-blur-xl border-r border-white/40 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none`}>
        <div className="h-16 px-6 border-b border-white/40 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-800 tracking-tight text-lg">LAVEN AI</span>
          </div>
          <button 
            className="md:hidden text-gray-500 hover:text-gray-900 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 py-8 px-5 space-y-2 overflow-y-auto">
          <p className="px-3 text-[11px] font-bold text-pink-600/70 uppercase tracking-widest mb-4">Workspace</p>
          
          <button 
            onClick={() => { setActiveTab("testing"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "testing" ? "bg-white/80 text-pink-600 font-semibold shadow-md shadow-pink-500/10 border border-white/50" : "text-gray-600 hover:bg-white/40 hover:text-gray-900 font-medium border border-transparent"}`}
          >
            <Terminal className={`w-4 h-4 ${activeTab === "testing" ? "text-pink-500" : ""}`} />
            <span className="text-sm">API Playground</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab("keys"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "keys" ? "bg-white/80 text-pink-600 font-semibold shadow-md shadow-pink-500/10 border border-white/50" : "text-gray-600 hover:bg-white/40 hover:text-gray-900 font-medium border border-transparent"}`}
          >
            <Key className={`w-4 h-4 ${activeTab === "keys" ? "text-pink-500" : ""}`} />
            <span className="text-sm">Access Keys</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab("logs"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === "logs" ? "bg-white/80 text-pink-600 font-semibold shadow-md shadow-pink-500/10 border border-white/50" : "text-gray-600 hover:bg-white/40 hover:text-gray-900 font-medium border border-transparent"}`}
          >
            <Activity className={`w-4 h-4 ${activeTab === "logs" ? "text-pink-500" : ""}`} />
            <span className="text-sm">Telemetry Logs</span>
          </button>
        </div>

        <div className="p-5 border-t border-white/40 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/40 border border-white/50 backdrop-blur-md shadow-sm">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </div>
            <span className="text-xs text-gray-700 font-semibold">Systems Nominal</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10" onClick={() => setModelSelectorOpen(false)}>
        
        {/* Header */}
        <header className="h-16 border-b border-white/30 bg-white/20 backdrop-blur-xl flex items-center justify-between px-6 lg:px-10 shrink-0 shadow-sm z-20 relative">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-gray-600 hover:text-gray-900 bg-white/50 p-2 rounded-lg"
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-medium text-gray-600 tracking-tight">
              {activeTab === "testing" && "API Endpoint Testing"}
              {activeTab === "keys" && "API Management"}
              {activeTab === "logs" && "Request Telemetry"}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800 tracking-tight text-xl hidden sm:block">LAVEN AI</span>
            <div className="w-9 h-9 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          
          {activeTab === "testing" && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Configuration Column */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-7 shadow-xl shadow-pink-500/5 relative z-20">
                  <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-wide">
                    <Database className="w-4 h-4 text-pink-500" />
                    Routing Config
                  </h3>
                  
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Upstream Gateway</label>
                      <select
                        className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-3.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition-all shadow-sm font-medium"
                        value={apiSource}
                        onChange={(e) => setApiSource(e.target.value as any)}
                      >
                        <option value="tusk">Tusk Central API</option>
                        <option value="heck">Heck.ai API</option>
                      </select>
                    </div>
                    <div className="space-y-2 relative z-[100]">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Target Model</label>
                      <div className="relative">
                        <div
                          className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-3.5 text-sm text-gray-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-pink-400 focus-within:border-pink-400 transition-all shadow-sm font-medium flex justify-between items-center cursor-pointer select-none"
                          onClick={(e) => { e.stopPropagation(); setModelSelectorOpen(!modelSelectorOpen); }}
                        >
                          <span>
                            {providers.find(p => p.key === selectedModelId)?.displayName || "Select a model..."}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${modelSelectorOpen ? 'rotate-180' : ''}`} />
                        </div>
                        
                        {modelSelectorOpen && (
                          <div 
                            className="absolute top-[calc(100%+0.5rem)] left-0 right-0 bg-white/95 backdrop-blur-3xl border border-white/80 rounded-xl shadow-2xl shadow-pink-500/30 z-[1000] max-h-64 overflow-y-auto custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {providers.map((p) => (
                              <div 
                                key={p.key} 
                                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-pink-50/50 border-b border-gray-100/50 last:border-0 transition-colors ${selectedModelId === p.key ? 'bg-pink-50/50 text-pink-600' : 'text-gray-700'}`}
                                onClick={() => { setSelectedModelId(p.key); setModelSelectorOpen(false); }}
                              >
                                <span className="font-medium text-sm flex items-center gap-2">
                                  {p.displayName} {p.isPremium && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Pro</span>}
                                </span>
                                <button
                                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-pink-300 hover:bg-pink-50 transition-colors bg-white/80"
                                  onClick={(e) => pingModel(e, p.key)}
                                >
                                  {pingStatuses[p.key] === 'testing' ? (
                                    <div className="w-3.5 h-3.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                                  ) : pingStatuses[p.key] === 'success' ? (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> OK
                                    </span>
                                  ) : pingStatuses[p.key] === 'error' ? (
                                    <span className="flex items-center gap-1 text-red-500">
                                      <div className="w-2 h-2 bg-red-500 rounded-full" /> No Res
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 hover:text-pink-600">Test Ping</span>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-7 shadow-xl shadow-pink-500/5 space-y-6 relative z-0">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wide">
                    <Code className="w-4 h-4 text-pink-500" />
                    Payload Definition
                  </h3>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">System Prompt</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none font-mono transition-colors shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">User Message</label>
                    <textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      rows={4}
                      className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none font-mono transition-colors shadow-sm"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group pt-2">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${streamResponse ? 'bg-pink-500 border-pink-500 text-white shadow-md shadow-pink-500/20' : 'bg-white/50 border-gray-300 text-transparent group-hover:border-pink-300'}`}>
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={streamResponse} 
                      onChange={(e) => setStreamResponse(e.target.checked)} 
                    />
                    <span className="text-sm font-semibold text-gray-700 select-none">Enable Server-Sent Events (SSE)</span>
                  </label>
                </div>
              </div>

              {/* Console/Execution Column */}
              <div className="lg:col-span-7 space-y-6 flex flex-col">
                <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-gray-800">
                  
                  {/* Console Header */}
                  <div className="h-14 border-b border-gray-700/50 bg-black/20 flex items-center justify-between px-5 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-sm shadow-[#FF5F56]/20" />
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-sm shadow-[#FFBD2E]/20" />
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] shadow-sm shadow-[#27C93F]/20" />
                      </div>
                      <span className="text-xs font-mono text-gray-400 tracking-wider">cURL_Request.sh</span>
                    </div>
                    <button 
                      onClick={() => handleCopy(curlCommand)}
                      className="text-gray-400 hover:text-white transition-colors bg-white/5 p-1.5 rounded-md hover:bg-white/10"
                      title="Copy Request"
                    >
                      {copiedKey === curlCommand ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Console Body */}
                  <div className="p-5 overflow-x-auto">
                    <pre className="text-[13px] font-mono text-pink-200/90 whitespace-pre leading-relaxed">
                      {curlCommand}
                    </pre>
                  </div>
                  
                  {/* Execution Bar */}
                  <div className="p-5 border-t border-gray-700/50 bg-black/20 flex items-center justify-between mt-auto shrink-0">
                    <div className="text-xs text-gray-400 font-mono">
                      {apiKeys.length === 0 ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <Shield className="w-4 h-4" /> Auth Required
                        </span>
                      ) : "System Ready"}
                    </div>
                    <button 
                      onClick={runTest}
                      disabled={testLoading}
                      className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-400 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:from-pink-600 hover:to-rose-500 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:shadow-none"
                    >
                      {testLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Execute
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Response Output */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl overflow-hidden flex-1 flex flex-col shadow-xl shadow-pink-500/5 min-h-[350px]">
                  <div className="h-14 border-b border-gray-200/60 bg-white/50 flex items-center justify-between px-6 shrink-0">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Execution Output</span>
                    {testLatency !== null && (
                      <span className="text-xs font-mono font-medium text-pink-600 bg-pink-50 border border-pink-100 px-3 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        {testLatency}ms
                      </span>
                    )}
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto">
                    {testResponse ? (
                      <pre className="text-[14px] font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {testResponse}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm font-mono gap-3">
                        <Terminal className="w-8 h-8 opacity-20" />
                        <p>Output will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "keys" && (
            <div className="max-w-5xl mx-auto space-y-8">
              
              <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-pink-500/5">
                <div className="max-w-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Admin Authentication</h3>
                  <p className="text-sm text-gray-600 mb-6 font-medium">Enter your admin secret to manage keys and view logs.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Shield className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input 
                        type="password" 
                        placeholder="Admin Secret" 
                        className="w-full bg-white/80 border border-white/80 rounded-2xl pl-11 pr-5 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm font-medium"
                        value={adminSecret}
                        onChange={(e) => setAdminSecret(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-pink-500/5">
                <div className="max-w-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Create Authentication Key</h3>
                  <p className="text-sm text-gray-600 mb-8 font-medium">Provision a new secure token for API access. Keys should be kept confidential and stored securely.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input 
                      type="text" 
                      placeholder="e.g. Production Environment" 
                      className="flex-1 bg-white/80 border border-white/80 rounded-2xl px-5 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm font-medium"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <button 
                      onClick={generateKey}
                      disabled={!newKeyName.trim()}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-400 text-white px-8 py-3.5 rounded-2xl font-semibold hover:from-pink-600 hover:to-rose-500 transition-all shadow-lg shadow-pink-500/25 shrink-0 disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                      Create Secret Key
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl overflow-hidden shadow-xl shadow-pink-500/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/40 border-b border-gray-200/50 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Application Name</th>
                        <th className="px-8 py-5">Secret Token</th>
                        <th className="px-8 py-5">Created On</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {apiKeys.map((k) => (
                        <tr key={k.key} className="hover:bg-white/50 transition-colors group">
                          <td className="px-8 py-5 font-semibold text-gray-800 whitespace-nowrap">{k.name}</td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-4">
                              <code className="font-mono text-pink-600 bg-pink-50 border border-pink-100/50 px-3 py-1.5 rounded-lg text-[13px] font-medium">
                                {k.key.substring(0, 8)}••••••••{k.key.substring(k.key.length - 4)}
                              </code>
                              <button 
                                onClick={() => handleCopy(k.key)}
                                className="text-gray-400 hover:text-pink-600 transition-colors bg-white shadow-sm border border-gray-100 p-1.5 rounded-md"
                              >
                                {copiedKey === k.key ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-gray-500 whitespace-nowrap text-[13px] font-medium">
                            {new Date(k.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-8 py-5 text-right whitespace-nowrap">
                            <button 
                              onClick={() => deleteKey(k.key)} 
                              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {apiKeys.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 mb-2">
                                <Key className="w-6 h-6 text-pink-300" />
                              </div>
                              <p className="text-sm font-medium text-gray-500">No active API keys found.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-pink-500/5">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Gateway Telemetry</h3>
                  <p className="text-sm text-gray-600 font-medium">Real-time monitoring of API requests, routing, and response latencies.</p>
                </div>
                <button 
                  onClick={fetchLogs} 
                  className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-5 py-2.5 rounded-xl hover:border-pink-300 hover:text-pink-600 transition-colors text-sm font-semibold shadow-sm"
                >
                  <Activity className="w-4 h-4" />
                  Sync Logs
                </button>
              </div>
              
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl overflow-hidden shadow-xl shadow-pink-500/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/40 border-b border-gray-200/50 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Timestamp</th>
                        <th className="px-8 py-5">Model Route</th>
                        <th className="px-8 py-5">Key Identity</th>
                        <th className="px-8 py-5">Latency</th>
                        <th className="px-8 py-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/50 transition-colors">
                          <td className="px-8 py-5 whitespace-nowrap text-gray-500 font-mono text-[13px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-8 py-5 font-semibold text-gray-800">
                            {log.model}
                          </td>
                          <td className="px-8 py-5 font-mono text-[13px] text-gray-500">
                            {log.key.substring(0, 8)}...
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-mono text-[13px] font-medium text-pink-600 bg-pink-50 px-2.5 py-1 rounded-md border border-pink-100/50">
                              {log.durationMs}ms
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest shadow-sm ${
                              log.status === 200 
                                ? 'bg-green-500 text-white' 
                                : 'bg-red-500 text-white'
                            }`}>
                              {log.status === 200 ? '200 OK' : `${log.status} ERR`}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100 mb-2">
                                <Activity className="w-6 h-6 text-pink-300" />
                              </div>
                              <p className="text-sm font-medium text-gray-500">No telemetry data recorded.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

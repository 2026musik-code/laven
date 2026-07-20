import React, { useState, useEffect } from "react";
import { Terminal, Send, Check, Copy, Code, Database, ChevronDown, Shield, Zap, Sparkles, Activity } from "lucide-react";

type Provider = {
  providerName: string;
  key: string;
  displayName: string;
  isPremium: boolean;
};

export default function App() {
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

  // User API Key state
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem("userApiKey") || "");
  
  useEffect(() => {
    localStorage.setItem("userApiKey", userApiKey);
  }, [userApiKey]);

  // Model Selection state
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [pingStatuses, setPingStatuses] = useState<Record<string, 'testing' | 'success' | 'error'>>({});

  useEffect(() => {
    fetchProviders();
  }, [apiSource]);

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

  const pingModel = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    setPingStatuses(prev => ({ ...prev, [modelId]: 'testing' }));
    try {
      const keyToUse = userApiKey || "sk-default-key-for-testing";
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

  const runTest = async () => {
    if (!selectedModelId) return;
    
    const keyToUse = userApiKey || "sk-default-key-for-testing";
    
    setTestLoading(true);
    setTestResponse("");
    setTestLatency(null);
    const start = Date.now();

    try {
      const modelTarget = `laven-${apiSource}/${selectedModelId}`;
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyToUse}`
        },
        body: JSON.stringify({
          model: modelTarget,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          stream: streamResponse
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        setTestResponse(`Error ${res.status}: ${JSON.stringify(errorData, null, 2)}`);
        setTestLoading(false);
        return;
      }

      if (streamResponse) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        if (reader) {
          let hasFirstChunk = false;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6);
                if (dataStr === "[DONE]") break;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices?.[0]?.delta?.content) {
                    setTestResponse((prev) => prev + data.choices[0].delta.content);
                    if (!hasFirstChunk) {
                      setTestLatency(Date.now() - start);
                      hasFirstChunk = true;
                    }
                  }
                } catch (e) {}
              }
            }
          }
          if (!hasFirstChunk) setTestLatency(Date.now() - start);
        }
      } else {
        const data = await res.json();
        setTestLatency(Date.now() - start);
        if (data.choices?.[0]?.message?.content) {
          setTestResponse(data.choices[0].message.content);
        } else {
          setTestResponse(JSON.stringify(data, null, 2));
        }
      }
    } catch (err: any) {
      setTestResponse(`Fetch error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const selectedModel = providers.find(p => p.key === selectedModelId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-inner">
            <Zap className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none mb-1">Laven AI</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Model Gateway Playground</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Shield className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="password"
              placeholder="Your API Key"
              value={userApiKey}
              onChange={e => setUserApiKey(e.target.value)}
              className="bg-gray-50 border border-gray-200 pl-10 pr-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <a href="/redeem" className="text-sm font-semibold text-indigo-500 hover:text-indigo-600">Get an API Key</a>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Target Source</h3>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button 
                onClick={() => setApiSource("tusk")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${apiSource === 'tusk' ? 'bg-white shadow-sm border border-gray-200 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                Tusk Models
              </button>
              <button 
                onClick={() => setApiSource("heck")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${apiSource === 'heck' ? 'bg-white shadow-sm border border-gray-200 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              >
                Heck Models
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Model Selection</h3>
            
            <button 
              onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
              className="w-full flex flex-col items-start bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 rounded-2xl p-4 text-left relative"
            >
              <div className="flex items-center gap-2 mb-1 w-full">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-gray-800">{selectedModel?.displayName || "Select a model"}</span>
                {selectedModel?.isPremium && <Sparkles className="w-3.5 h-3.5 text-amber-500 ml-1" />}
                <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
              <span className="text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200 mt-2">
                laven-{apiSource}/{selectedModel?.key || "unknown"}
              </span>
            </button>

            {modelSelectorOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 max-h-[400px] overflow-y-auto overflow-x-hidden">
                <div className="p-2 space-y-1">
                  {providers.map((p) => (
                    <div 
                      key={p.key}
                      onClick={() => { setSelectedModelId(p.key); setModelSelectorOpen(false); }}
                      className={`flex flex-col p-3 rounded-xl cursor-pointer transition-all border ${selectedModelId === p.key ? 'bg-indigo-50 border-indigo-100' : 'bg-transparent border-transparent hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${selectedModelId === p.key ? 'text-indigo-700' : 'text-gray-700'}`}>{p.displayName}</span>
                          {p.isPremium && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>}
                        </div>
                        <button 
                          onClick={(e) => pingModel(e, p.key)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider transition-all border ${
                            pingStatuses[p.key] === 'testing' ? 'bg-blue-50 text-blue-500 border-blue-100' :
                            pingStatuses[p.key] === 'success' ? 'bg-green-50 text-green-600 border-green-100' :
                            pingStatuses[p.key] === 'error' ? 'bg-red-50 text-red-500 border-red-100' :
                            'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          {pingStatuses[p.key] === 'testing' ? 'PINGING...' : 
                           pingStatuses[p.key] === 'success' ? 'OK (200)' : 
                           pingStatuses[p.key] === 'error' ? 'ERROR' : 'PING'}
                        </button>
                      </div>
                      <span className="text-[11px] font-mono text-gray-400">laven-{apiSource}/{p.key}</span>
                    </div>
                  ))}
                  {providers.length === 0 && (
                    <div className="p-4 text-center text-sm font-medium text-gray-400">No models found for this source.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Settings</h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={streamResponse} 
                  onChange={(e) => setStreamResponse(e.target.checked)} 
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${streamResponse ? 'bg-indigo-500' : 'bg-gray-200'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${streamResponse ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
              <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Enable Streaming Response</span>
            </label>
          </div>

        </div>

        {/* Right Content */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-1 border border-gray-100 shadow-sm flex flex-col h-[650px] overflow-hidden relative">
            
            <div className="flex-1 flex flex-col h-full bg-gray-50 rounded-[22px] overflow-hidden border border-gray-100">
              {/* Header */}
              <div className="bg-white px-5 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Test Request</span>
                </div>
                {testLatency && (
                  <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">
                    <Activity className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-[11px] font-mono font-bold text-green-600">{testLatency}ms</span>
                  </div>
                )}
              </div>

              {/* Editor Area */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">System Instructions</label>
                  <textarea 
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">User Message</label>
                  <textarea 
                    value={userPrompt}
                    onChange={e => setUserPrompt(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none shadow-sm"
                    rows={4}
                  />
                </div>
                
                {testResponse && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Assistant Response</label>
                    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 shadow-inner">
                      <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap leading-relaxed">{testResponse}</pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-white border-t border-gray-200 shrink-0 flex items-center justify-between">
                <div className="text-xs font-mono text-gray-400">
                  {userApiKey ? "Using API Key" : "No API Key (Limited to 50 req/hr)"}
                </div>
                <button 
                  onClick={runTest}
                  disabled={testLoading}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {testLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {testLoading ? 'Processing...' : 'Send Request'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center pb-6 text-sm text-gray-400">
        <a href="/admin" className="hover:text-gray-600 transition-colors">Admin Dashboard</a>
      </div>
    </div>
  );
}

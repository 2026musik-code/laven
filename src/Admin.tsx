import React, { useState, useEffect } from "react";
import { Key, Trash2, Shield, Settings, Activity, Plus, Users, Hash } from "lucide-react";

export default function Admin() {
  const [adminSecret, setAdminSecret] = useState<string>(() => localStorage.getItem("adminSecret") || "");
  const [activeTab, setActiveTab] = useState<"users" | "codes" | "settings">("users");
  
  const [keys, setKeys] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  
  // Forms
  const [newUser, setNewUser] = useState("");
  const [newUserLimit, setNewUserLimit] = useState(100);
  
  const [newCodeLimit, setNewCodeLimit] = useState(100);
  
  const [newToken, setNewToken] = useState("");
  const [tokenMsg, setTokenMsg] = useState("");

  useEffect(() => {
    localStorage.setItem("adminSecret", adminSecret);
    if (adminSecret) {
      if (activeTab === "users") fetchKeys();
      if (activeTab === "codes") fetchCodes();
    }
  }, [adminSecret, activeTab]);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/admin/keys", {
        headers: { "Authorization": `Bearer ${adminSecret}` }
      });
      if (res.ok) setKeys(await res.json());
    } catch (e) {}
  };

  const fetchCodes = async () => {
    try {
      const res = await fetch("/api/admin/codes", {
        headers: { "Authorization": `Bearer ${adminSecret}` }
      });
      if (res.ok) setCodes(await res.json());
    } catch (e) {}
  };

  const createKey = async () => {
    if (!newUser) return;
    await fetch("/api/admin/keys", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminSecret}` 
      },
      body: JSON.stringify({ name: newUser, user: newUser, limit: newUserLimit })
    });
    setNewUser("");
    fetchKeys();
  };

  const deleteKey = async (key: string) => {
    if (!confirm("Are you sure?")) return;
    await fetch(`/api/admin/keys/${key}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminSecret}` }
    });
    fetchKeys();
  };

  const createCode = async () => {
    await fetch("/api/admin/codes", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminSecret}` 
      },
      body: JSON.stringify({ limit: newCodeLimit })
    });
    fetchCodes();
  };

  const deleteCode = async (code: string) => {
    if (!confirm("Are you sure?")) return;
    await fetch(`/api/admin/codes/${code}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminSecret}` }
    });
    fetchCodes();
  };

  const changeToken = async () => {
    if (!newToken) return;
    const res = await fetch("/api/admin/change-token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminSecret}` 
      },
      body: JSON.stringify({ newToken })
    });
    if (res.ok) {
      setAdminSecret(newToken);
      setNewToken("");
      setTokenMsg("Token updated successfully!");
      setTimeout(() => setTokenMsg(""), 3000);
    } else {
      setTokenMsg("Failed to update token");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="password"
              placeholder="Admin Secret"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="px-4 py-2 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>
        </header>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === "users" ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "bg-white text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Users className="w-5 h-5" /> Users & Keys
          </button>
          <button
            onClick={() => setActiveTab("codes")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === "codes" ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "bg-white text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Hash className="w-5 h-5" /> Redeem Codes
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === "settings" ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "bg-white text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>

        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Username</label>
                <input
                  type="text"
                  value={newUser}
                  onChange={e => setNewUser(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter username"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Limit/Hr</label>
                <input
                  type="number"
                  value={newUserLimit}
                  onChange={e => setNewUserLimit(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={createKey}
                className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-600 transition-colors h-[50px]"
              >
                Create User
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">API Key</th>
                    <th className="px-6 py-4">Requests (Total)</th>
                    <th className="px-6 py-4">Limit (Per Hour)</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {keys.map((k) => (
                    <tr key={k.key} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium">{k.user || k.name}</td>
                      <td className="px-6 py-4"><code className="text-xs bg-gray-100 px-2 py-1 rounded text-indigo-600">{k.key}</code></td>
                      <td className="px-6 py-4 font-mono">{k.requests || 0}</td>
                      <td className="px-6 py-4 font-mono">{k.limit || 100}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteKey(k.key)} className="text-red-400 hover:text-red-600 p-2">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "codes" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-end">
              <div className="w-48">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Limit/Hr</label>
                <input
                  type="number"
                  value={newCodeLimit}
                  onChange={e => setNewCodeLimit(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={createCode}
                className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-600 transition-colors h-[50px]"
              >
                Generate Code
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Limit (Per Hour)</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {codes.map((c) => (
                    <tr key={c.code} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4"><code className="text-sm font-bold bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200">{c.code}</code></td>
                      <td className="px-6 py-4 font-mono">{c.limit || 100}</td>
                      <td className="px-6 py-4">
                        {c.used ? (
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Used by {c.usedBy}</span>
                        ) : (
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteCode(c.code)} className="text-red-400 hover:text-red-600 p-2">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-lg">
            <h2 className="text-lg font-bold mb-6">Change Admin Token</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">New Token Secret</label>
                <input
                  type="text"
                  value={newToken}
                  onChange={e => setNewToken(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new strong token"
                />
              </div>
              <button
                onClick={changeToken}
                className="w-full bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-600 transition-colors"
              >
                Update Token
              </button>
              {tokenMsg && (
                <p className="text-sm font-medium text-center text-green-600">{tokenMsg}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

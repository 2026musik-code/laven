import React, { useState } from "react";
import { Key, Gift, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Redeem() {
  const [code, setCode] = useState("");
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, user })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Failed to redeem code");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-green-500/10 max-w-md w-full border border-green-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Redeem Successful!</h2>
          <p className="text-gray-500 mb-8">Here is your new API Key. Please save it in a secure location.</p>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 break-all text-left">
            <code className="text-sm font-medium text-green-600">{result.key}</code>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Limit: {result.limit} requests / hour
          </div>
          
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-8 w-full bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
          >
            Go to Playground
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-500/10 max-w-md w-full border border-gray-100">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-100">
            <Gift className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Redeem Invite Code</h2>
        <p className="text-center text-gray-500 text-sm mb-8">Enter your unique code to generate an API key.</p>
        
        <form onSubmit={handleRedeem} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Invite Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
              placeholder="LAVEN-XXXXXX"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Your Name / Username</label>
            <input
              type="text"
              required
              value={user}
              onChange={e => setUser(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. John Doe"
            />
          </div>
          
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium border border-red-100">{error}</div>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-indigo-600 transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : "Redeem Now"} <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# Add X to imports
content = content.replace('Activity } from "lucide-react";', 'Activity, X } from "lucide-react";')

# Add modal states
modal_states = """  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemUser, setRedeemUser] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemLoading(true);
    setRedeemError("");
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode, user: redeemUser })
      });
      const data = await res.json();
      if (res.ok) {
        setUserApiKey(data.key);
        setRedeemModalOpen(false);
        setRedeemCode("");
        setRedeemUser("");
        alert(`Redeem Successful!\\n\\nYour API Key: ${data.key}\\nLimit: ${data.limit} requests/hour\\n\\nPlease save your key, it has been auto-filled.`);
      } else {
        setRedeemError(data.error || "Failed to redeem code");
      }
    } catch (err) {
      setRedeemError("An unexpected error occurred");
    }
    setRedeemLoading(false);
  };
"""

content = content.replace('  // Model Selection state', modal_states + '\n  // Model Selection state')

# Change "Get an API Key" link to button
content = content.replace('<a href="/redeem" className="text-sm font-semibold text-indigo-500 hover:text-indigo-600">Get an API Key</a>', 
                          '<button onClick={() => setRedeemModalOpen(true)} className="text-sm font-semibold text-indigo-500 hover:text-indigo-600">Get an API Key</button>')

# Add modal JSX
modal_jsx = """
      {redeemModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">Redeem Invite Code</h2>
              <button onClick={() => setRedeemModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleRedeem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Invite Code</label>
                  <input
                    type="text"
                    required
                    value={redeemCode}
                    onChange={e => setRedeemCode(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                    placeholder="LAVEN-XXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Your Name / Username</label>
                  <input
                    type="text"
                    required
                    value={redeemUser}
                    onChange={e => setRedeemUser(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. John Doe"
                  />
                </div>
                
                {redeemError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium border border-red-100">{redeemError}</div>}
                
                <button
                  type="submit"
                  disabled={redeemLoading}
                  className="w-full bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-600 transition-all disabled:opacity-50 mt-2"
                >
                  {redeemLoading ? "Processing..." : "Redeem Now"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
"""
content = content.replace('    </div>\n  );\n}\n', modal_jsx + '    </div>\n  );\n}\n')

with open("src/App.tsx", "w") as f:
    f.write(content)


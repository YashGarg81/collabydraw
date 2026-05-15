"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Key, Webhook, Trash2, Plus, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Key state
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);

  // New Webhook state
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchKeys();
      fetchWebhooks();
    }
  }, [session]);

  const fetchKeys = async () => {
    const res = await fetch("/api/integrations/keys");
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
    }
    setLoading(false);
  };

  const fetchWebhooks = async () => {
    const res = await fetch("/api/integrations/webhooks");
    if (res.ok) {
      const data = await res.json();
      setWebhooks(data.webhooks);
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch("/api/integrations/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res.ok) {
      setNewKeyName("");
      fetchKeys();
    }
    setCreatingKey(false);
  };

  const deleteKey = async (id: string) => {
    await fetch(`/api/integrations/keys?id=${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    setCreatingWebhook(true);
    const res = await fetch("/api/integrations/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newWebhookUrl }),
    });
    if (res.ok) {
      setNewWebhookUrl("");
      fetchWebhooks();
    }
    setCreatingWebhook(false);
  };

  const deleteWebhook = async (id: string) => {
    await fetch(`/api/integrations/webhooks?id=${id}`, { method: "DELETE" });
    fetchWebhooks();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="p-8 text-white/50">Loading integrations...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Integrations & API</h1>
        <p className="text-white/60">Manage your API keys and webhooks to connect CollabyDraw with your favorite tools.</p>
      </div>

      {/* API Keys */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400"><Key className="w-5 h-5" /></div>
          <h2 className="text-xl font-semibold text-white">API Keys</h2>
        </div>
        
        <div className="space-y-4 mb-6">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
              <div>
                <div className="font-medium text-white">{k.name}</div>
                <div className="text-sm text-white/40 font-mono mt-1 blur-sm hover:blur-none transition-all cursor-pointer" onClick={() => handleCopy(k.key)}>
                  {k.key}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-white/30">
                  {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                </span>
                <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {keys.length === 0 && <div className="text-sm text-white/40">No API keys generated yet.</div>}
        </div>

        <div className="flex items-center gap-3">
          <Input 
            placeholder="Key name (e.g. Zapier Integration)" 
            value={newKeyName} 
            onChange={e => setNewKeyName(e.target.value)} 
            className="max-w-xs bg-black/20 border-white/10"
          />
          <Button onClick={createKey} disabled={!newKeyName.trim() || creatingKey} className="bg-violet-600 hover:bg-violet-500">
            <Plus className="w-4 h-4 mr-2" /> Generate Key
          </Button>
        </div>
      </section>

      {/* Webhooks */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Webhook className="w-5 h-5" /></div>
          <h2 className="text-xl font-semibold text-white">Webhooks</h2>
        </div>

        <div className="space-y-4 mb-6">
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
              <div>
                <div className="font-medium text-white">{w.url}</div>
                <div className="text-sm text-white/40 mt-1">Events: {JSON.parse(w.events || "[]").join(", ")}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteWebhook(w.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {webhooks.length === 0 && <div className="text-sm text-white/40">No webhooks configured yet.</div>}
        </div>

        <div className="flex items-center gap-3">
          <Input 
            placeholder="https://your-server.com/webhook" 
            value={newWebhookUrl} 
            onChange={e => setNewWebhookUrl(e.target.value)} 
            className="flex-1 max-w-md bg-black/20 border-white/10"
          />
          <Button onClick={createWebhook} disabled={!newWebhookUrl.trim() || creatingWebhook} className="bg-emerald-600 hover:bg-emerald-500">
            <Plus className="w-4 h-4 mr-2" /> Add Webhook
          </Button>
        </div>
      </section>
    </div>
  );
}

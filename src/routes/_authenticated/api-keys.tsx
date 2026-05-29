import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, KeyRound, Plus, Trash2, ShieldAlert, Code2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/api-keys")({
  component: ApiKeysPage,
});

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  note: string | null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): { raw: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const raw = `dlp_${body}`;
  return { raw, prefix: raw.slice(0, 12) };
}

function ApiKeysPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const allowed = hasRole(["admin", "kepala"]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("external_api_keys")
        .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at, note")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setKeys((data ?? []) as ApiKey[]);
      setLoading(false);
    };
    load();
  }, [allowed]);

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Hanya admin & kepala BRIDA yang dapat mengelola kunci API.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim() || name.trim().length < 3) {
      return toast.error("Nama kunci minimal 3 karakter");
    }
    setCreating(true);
    const { raw, prefix } = generateKey();
    const hash = await sha256Hex(raw);
    const { data, error } = await supabase
      .from("external_api_keys")
      .insert({
        name: name.trim(),
        note: note.trim() || null,
        key_prefix: prefix,
        key_hash: hash,
        created_by: user.id,
      })
      .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at, note")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setKeys((prev) => [data as ApiKey, ...prev]);
    setRevealedKey(raw);
    setName("");
    setNote("");
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Cabut kunci ini? Aplikasi eksternal akan langsung kehilangan akses.")) return;
    const { error } = await supabase
      .from("external_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)),
    );
    toast.success("Kunci dicabut");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus permanen kunci ini?")) return;
    const { error } = await supabase.from("external_api_keys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/external/tasks`
      : "/api/public/external/tasks";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight">Kunci API Eksternal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Buat kunci untuk integrasi dengan SIAP/SISKEPES atau sistem lain. Kunci hanya
          ditampilkan sekali saat dibuat.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Buat Kunci Baru
          </CardTitle>
          <CardDescription>
            Tugas yang masuk via kunci ini akan tercatat atas nama pembuat kunci.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="key-name">Nama kunci</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Integrasi SIAP"
              />
            </div>
            <div>
              <Label htmlFor="key-note">Catatan (opsional)</Label>
              <Input
                id="key-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Untuk sinkronisasi NIP & pangkat"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            <KeyRound className="h-4 w-4" /> {creating ? "Membuat…" : "Buat kunci"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4" /> Endpoint
          </CardTitle>
          <CardDescription>POST untuk membuat tugas dari sistem eksternal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono break-all">
            <span className="font-semibold text-primary">POST</span>
            <span>{baseUrl}</span>
            <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" aria-label={copied ? "Tersalin" : "Salin URL"} onClick={() => copy(baseUrl)}>
              {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed">
{`curl -X POST '${baseUrl}' \\
  -H 'X-API-Key: <KUNCI_API>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Tugas dari SIAP",
    "description": "Dibuat otomatis",
    "priority": "normal",
    "deadline": "2026-06-15T10:00:00.000Z",
    "assigned_to": "<uuid_pengguna>",
    "external_ref": "SIAP-2026-0001"
  }'`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Wajib menyertakan <code>assigned_to</code> (UUID pengguna) atau{" "}
            <code>assigned_to_pokja</code> (UUID pokja).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Kunci</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kunci API.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{k.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                        {k.key_prefix}…
                      </code>
                      {k.revoked_at ? (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          DICABUT
                        </span>
                      ) : (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                          AKTIF
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Dibuat {new Date(k.created_at).toLocaleString("id-ID")}
                      {k.last_used_at &&
                        ` • Digunakan terakhir ${new Date(k.last_used_at).toLocaleString("id-ID")}`}
                      {k.note && ` • ${k.note}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!k.revoked_at && (
                      <Button size="sm" variant="outline" onClick={() => handleRevoke(k.id)}>
                        Cabut
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={`Hapus kunci ${k.name}`} onClick={() => handleDelete(k.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!revealedKey} onOpenChange={(o) => !o && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunci API Anda</DialogTitle>
            <DialogDescription>
              Salin & simpan kunci ini sekarang. Kunci tidak akan ditampilkan lagi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <code className="flex-1 break-all font-mono text-xs">{revealedKey}</code>
            <Button
              size="icon"
              variant="ghost"
              aria-label={copied ? "Tersalin" : "Salin kunci API"}
              onClick={() => revealedKey && copy(revealedKey)}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Saya sudah menyalin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

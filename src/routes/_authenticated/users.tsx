import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, JENJANG_LABEL, ROLE_LABEL, type Jenjang, type AppRole } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

interface Row {
  id: string;
  full_name: string;
  jabatan: string | null;
  jenjang: Jenjang;
  pokja_id: string | null;
  nip: string | null;
  pangkat_golongan: string | null;
}

function UsersPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const allowed = hasRole(["kepala", "sekretaris", "admin"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole[]>>({});
  const [pokja, setPokja] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: p }, { data: r }, { data: pk }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("pokja").select("id, name").order("name"),
    ]);
    setRows((p as Row[]) ?? []);
    const m: Record<string, AppRole[]> = {};
    (r ?? []).forEach((x: { user_id: string; role: AppRole }) => {
      m[x.user_id] = [...(m[x.user_id] ?? []), x.role];
    });
    setRoles(m);
    setPokja(pk ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (authLoading) return null;
  if (!allowed) return <Navigate to="/dashboard" />;

  const updateJenjang = async (id: string, v: Jenjang) => {
    const { error } = await supabase.from("profiles").update({ jenjang: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Jenjang diperbarui");
    load();
  };

  const updatePokja = async (id: string, v: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ pokja_id: v === "none" ? null : v })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pokja diperbarui");
    load();
  };

  const updateRole = async (id: string, v: AppRole) => {
    // Replace existing roles with the chosen primary role
    await supabase.from("user_roles").delete().eq("user_id", id);
    const { error } = await supabase.from("user_roles").insert({ user_id: id, role: v });
    if (error) return toast.error(error.message);
    toast.success("Peran diperbarui");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Pengguna</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atur jenjang, peran, dan pokja untuk seluruh pengguna sistem.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">NIP</th>
                  <th className="px-4 py-3">Pangkat / Golongan</th>
                  <th className="px-4 py-3">Jenjang</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3">Pokja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{r.full_name}</div>
                      {r.jabatan && (
                        <div className="text-xs text-muted-foreground">{r.jabatan}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <Select value={r.jenjang} onValueChange={(v) => updateJenjang(r.id, v as Jenjang)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(JENJANG_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <Select
                        value={roles[r.id]?.[0] ?? "pokja_member"}
                        onValueChange={(v) => updateRole(r.id, v as AppRole)}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <Select
                        value={r.pokja_id ?? "none"}
                        onValueChange={(v) => updatePokja(r.id, v)}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Tidak ada —</SelectItem>
                          {pokja.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

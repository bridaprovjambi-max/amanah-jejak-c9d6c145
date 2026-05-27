import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Layers, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pokja")({
  component: PokjaPage,
});

interface Pokja {
  id: string;
  name: string;
  description: string | null;
}

interface Member {
  id: string;
  full_name: string;
  jabatan: string | null;
  pokja_id: string | null;
}

function PokjaPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(["kepala", "sekretaris", "admin"]);
  const [pokja, setPokja] = useState<Pokja[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from("pokja").select("*").order("name"),
      supabase.from("profiles").select("id, full_name, jabatan, pokja_id"),
    ]);
    setPokja(p ?? []);
    setMembers(m ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Nama pokja terlalu pendek");
    const { error } = await supabase.from("pokja").insert({
      name: name.trim(),
      description: desc.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pokja dibuat");
    setOpen(false);
    setName("");
    setDesc("");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Kelompok Kerja Riset</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pokja bertanggung jawab kepada Kepala BRIDA & Sekretaris BRIDA.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Tambah Pokja
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pokja Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nama pokja *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kelompok Kerja Inovasi Daerah"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Deskripsi</Label>
                  <Textarea
                    id="desc"
                    rows={3}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Simpan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : pokja.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada Kelompok Kerja.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pokja.map((p) => {
            const ms = members.filter((m) => m.pokja_id === p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-lg">{p.name}</h3>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    )}
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    <UsersIcon className="h-3.5 w-3.5" /> Anggota ({ms.length})
                  </div>
                  {ms.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Belum ada anggota. Tetapkan via menu Pengguna.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {ms.map((m) => (
                        <li key={m.id} className="text-sm flex justify-between">
                          <span className="font-medium">{m.full_name}</span>
                          {m.jabatan && (
                            <span className="text-muted-foreground text-xs">{m.jabatan}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

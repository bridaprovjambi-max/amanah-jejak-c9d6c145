import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JABATAN_PRESETS } from "@/lib/jabatan-presets";
import delapanLogo from "@/assets/delapan-logo.webp";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Daftar — DeLapan" },
      { name: "description", content: "Buat akun DeLapan untuk bergabung dengan ekosistem pelaporan internal BRIDA Provinsi Jambi." },
      { property: "og:title", content: "Daftar — DeLapan" },
      { property: "og:description", content: "Bergabung dengan ekosistem pelaporan internal BRIDA Jambi." },
      { property: "og:url", content: "/signup" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  jabatan: z.string().trim().max(160).optional(),
  nip: z.string().trim().max(30).regex(/^[0-9]*$/, "NIP hanya boleh berisi angka").optional(),
  pangkat_golongan: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Minimal 8 karakter").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    jabatan: "",
    nip: "",
    pangkat_golongan: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: parsed.data.full_name,
          jabatan: parsed.data.jabatan ?? "",
          nip: parsed.data.nip ?? "",
          pangkat_golongan: parsed.data.pangkat_golongan ?? "",
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pendaftaran berhasil! Administrator akan menetapkan peran & jenjang Anda.");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-white p-1 shadow-sm">
            <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
          </div>
          <div className="font-display font-bold">DeLapan</div>
        </Link>
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight">
            Bergabung dengan DeLapan.
          </h2>
          <p className="mt-4 text-white/70 text-sm max-w-md">
            Pendaftaran ini untuk pejabat & anggota pokja. Pastikan jenjang yang Anda pilih
            sesuai jabatan.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-2xl font-bold">Buat akun baru</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Masuk
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jabatan">Jabatan</Label>
              <Select value={form.jabatan} onValueChange={(v) => update("jabatan", v)}>
                <SelectTrigger id="jabatan">
                  <SelectValue placeholder="Pilih jabatan" />
                </SelectTrigger>
                <SelectContent>
                  {JABATAN_PRESETS.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nip">NIP</Label>
                <Input
                  id="nip"
                  inputMode="numeric"
                  placeholder="contoh: 198501012010012001"
                  value={form.nip}
                  onChange={(e) => update("nip", e.target.value.replace(/\D/g, ""))}
                  maxLength={30}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pangkat_golongan">Pangkat / Golongan</Label>
                <Input
                  id="pangkat_golongan"
                  placeholder="contoh: Penata Tk. I / III-d"
                  value={form.pangkat_golongan}
                  onChange={(e) => update("pangkat_golongan", e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
              Jenjang & peran Anda akan ditetapkan oleh administrator setelah akun dibuat.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Kata sandi</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Mendaftarkan…" : "Daftar"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

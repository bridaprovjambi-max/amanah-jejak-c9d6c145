import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import bridaLogo from "@/assets/brida-logo.svg";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  jabatan: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Minimal 8 karakter").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    jabatan: "",
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-white p-1 shadow-sm">
            <img src={bridaLogo} alt="Logo BRIDA" className="h-full w-full object-contain" />
          </div>
          <div className="font-display font-bold">Delegasi & Pelaporan Internal BRIDA</div>
        </Link>
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight">
            Bergabung dengan Delegasi dan Pelaporan Internal BRIDA.
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
              <Input
                id="jabatan"
                placeholder="contoh: Kasubbag Umum & Kepegawaian"
                value={form.jabatan}
                onChange={(e) => update("jabatan", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenjang</Label>
              <Select
                value={form.jenjang}
                onValueChange={(v) => {
                  const jj = v as Jenjang;
                  update("jenjang", jj);
                  update("role", ROLE_BY_JENJANG[jj]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(JENJANG_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => update("role", v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Peran dapat disesuaikan kembali oleh administrator.
              </p>
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
    </div>
  );
}

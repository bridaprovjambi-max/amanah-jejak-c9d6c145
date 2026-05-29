import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import delapanLogo from "@/assets/delapan-logo.png";

export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().trim().email("Email tidak valid").max(255),
  password: z.string().min(6, "Minimal 6 karakter").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Selamat datang!");
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
            "Akuntabilitas dimulai dari pelaporan yang tepat waktu."
          </h2>
          <p className="mt-4 text-white/70 text-sm">
            Sistem internal Badan Riset dan Inovasi Daerah.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-white p-0.5 ring-1 ring-border">
              <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
            </div>
            <span className="font-display font-bold">Delegasi & Pelaporan</span>
          </Link>
          <h1 className="font-display text-2xl font-bold">Masuk ke akun Anda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Daftar
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Memproses…" : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Jenjang = "eselon_ii" | "eselon_iii" | "eselon_iv" | "pokja" | "staf" | "jafung";
export type AppRole = "admin" | "kepala" | "sekretaris" | "kasubbag" | "pokja_member" | "staf_pelaksana" | "jafung_member" | "ketua_pokja_riset" | "ketua_pokja_inovasi";

export interface Profile {
  id: string;
  full_name: string;
  jabatan: string | null;
  jenjang: Jenjang;
  pokja_id: string | null;
  telegram_chat_id: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole | AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const hasRole = (r: AppRole | AppRole[]) => {
    if (roles.includes("admin" as AppRole)) return true;
    const arr = Array.isArray(r) ? r : [r];
    return arr.some((x) => roles.includes(x));
  };

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    hasRole,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export const JENJANG_LABEL: Record<Jenjang, string> = {
  eselon_ii: "Kepala BRIDA Provinsi Jambi (Eselon II)",
  eselon_iii: "Sekretaris BRIDA Provinsi Jambi (Eselon III)",
  eselon_iv: "Kepala Sub Bagian Umum dan Kepegawaian (Eselon IV)",
  pokja: "Kelompok Kerja (Riset / Inovasi)",
  staf: "Staf / Pelaksana",
  jafung: "Rumpun Jabatan Fungsional",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  kepala: "Kepala BRIDA",
  sekretaris: "Sekretaris BRIDA",
  kasubbag: "Kasubbag Umum & Kepegawaian",
  pokja_member: "Anggota Pokja",
  staf_pelaksana: "Staf / Pelaksana (lapor ke Kasubbag & Sekretaris)",
  jafung_member: "Anggota Jabatan Fungsional (lapor ke Sekretaris & Kepala)",
  ketua_pokja_riset: "Ketua Pokja Riset",
  ketua_pokja_inovasi: "Ketua Pokja Inovasi",
};

export const JAFUNG_POSITIONS = [
  "Jabatan Fungsional Peneliti Madya",
  "Jabatan Fungsional Peneliti Muda",
  "Jabatan Fungsional Perencana Muda",
  "Jabatan Fungsional Analis Kebijakan Muda",
  "Jabatan Fungsional Analis Data Ilmiah",
  "Jabatan Fungsional Arsiparis Muda",
] as const;

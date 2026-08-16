import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Sign in to WA Reminder Studio to schedule one-time and recurring WhatsApp reminder messages for your contacts and groups.",
      },
      { property: "og:title", content: "Sign in — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Access your scheduled WhatsApp reminders, contacts, and delivery log.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && session && pathname === "/auth") {
      void navigate({ to: "/" });
    }
  }, [loading, session, navigate, pathname]);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="surface-pattern absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">WA Reminder Studio</span>
        </div>
        <div className="relative max-w-md space-y-5">
          <h1 className="text-4xl leading-tight text-primary-foreground">
            Pengingat WhatsApp yang terjadwal rapi.
          </h1>
          <p className="text-sm leading-relaxed text-primary-foreground/80">
            Atur pesan sekali kirim pada tanggal dan jam tertentu, jadwal harian, mingguan, bulanan, atau
            ekspresi cron kustom — lengkap dengan kontak, grup, dan catatan pengiriman.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Timezone-aware scheduling · Delivery log · Worker bridge
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MessageCircle className="h-5 w-5" />
            </span>
          </div>
          <h2 className="text-2xl font-semibold">Selamat datang</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Masuk untuk mengelola pengingat WhatsApp Anda.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Masuk</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <AuthForm mode="signin" />
            </TabsContent>
            <TabsContent value="signup">
              <AuthForm mode="signup" />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Akun dibuat. Silakan masuk.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Berhasil masuk");
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) void navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-name`}>Nama</Label>
          <Input
            id={`${mode}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama Anda"
            autoComplete="name"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input
          id={`${mode}-email`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@perusahaan.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Kata sandi</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "signup" ? "Buat akun" : "Masuk"}
      </Button>
    </form>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile } from "@/lib/db";
import { TIMEZONES } from "@/lib/schedule";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Atur nama tampilan, zona waktu default penjadwalan, dan lihat cara menghubungkan worker WhatsApp Anda.",
      },
      { property: "og:title", content: "Pengaturan — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Zona waktu default, profil, dan status koneksi worker pengirim WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.display_name ?? "");
      setTimezone(profile.data.timezone);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak ditemukan");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName || null, timezone });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pengaturan disimpan");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Pengaturan" description="Profil, zona waktu, dan koneksi pengirim." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Nama tampilan</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Zona waktu default</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} readOnly disabled />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Simpan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Koneksi WhatsApp</CardTitle>
            <Badge variant="secondary" className="gap-1">
              <PlugZap className="h-3 w-3" />
              Menunggu worker
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Aplikasi ini menjadwalkan dan mengantrekan pesan. Pengiriman sesungguhnya dilakukan oleh
              worker <span className="font-medium text-foreground">whatsapp-web.js</span> milik Anda yang
              berjalan di server Node sendiri (butuh Puppeteer, tidak bisa berjalan di hosting ini).
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
              <p>GET /api/public/whatsapp/pull</p>
              <p>POST /api/public/whatsapp/status</p>
              <p className="mt-2 text-muted-foreground">Header: x-worker-secret: WHATSAPP_WORKER_SECRET</p>
            </div>
            <p>
              Worker menarik pesan berstatus <code>queued</code>, mengirimnya melalui whatsapp-web.js, lalu
              melaporkan hasilnya kembali ke endpoint status.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/worker-setup">
                <BookOpen className="h-4 w-4" />
                Panduan setup worker (Windows 10)
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

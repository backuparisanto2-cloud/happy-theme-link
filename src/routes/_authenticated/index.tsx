import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Clock, Users, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchContacts, fetchLogs, fetchReminders } from "@/lib/db";
import { formatInTimezone } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Ringkasan — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Pantau pengingat WhatsApp aktif, jadwal berikutnya, dan status pengiriman terbaru dalam satu dasbor.",
      },
      { property: "og:title", content: "Ringkasan — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Dasbor pengingat WhatsApp: jadwal aktif, antrean berikutnya, dan status pengiriman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: fetchReminders });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const logs = useQuery({ queryKey: ["logs"], queryFn: fetchLogs });

  const activeReminders = (reminders.data ?? []).filter((r) => r.status === "active");
  const upcoming = activeReminders
    .filter((r) => r.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())
    .slice(0, 5);
  const sent = (logs.data ?? []).filter((l) => l.status === "sent").length;
  const failed = (logs.data ?? []).filter((l) => l.status === "failed").length;
  const queued = (logs.data ?? []).filter((l) => l.status === "queued" || l.status === "sending").length;

  return (
    <>
      <PageHeader
        title="Ringkasan"
        description="Semua jadwal pengingat WhatsApp Anda dalam satu tampilan."
        action={
          <Button asChild>
            <Link to="/reminders">Buat pengingat</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BellRing} label="Pengingat aktif" value={activeReminders.length} />
        <StatCard icon={Users} label="Kontak" value={contacts.data?.length ?? 0} />
        <StatCard icon={CheckCircle2} label="Terkirim" value={sent} tone="success" />
        <StatCard icon={AlertTriangle} label="Gagal" value={failed} tone="destructive" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Jadwal berikutnya</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada jadwal aktif. Buat pengingat pertama Anda.
              </p>
            )}
            {upcoming.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{reminder.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{reminder.message}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {reminder.next_run_at
                      ? formatInTimezone(new Date(reminder.next_run_at), reminder.timezone)
                      : "—"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Antrean pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold text-primary">{queued}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              pesan menunggu diambil oleh worker WhatsApp Anda.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/logs">Lihat riwayat</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof BellRing;
  label: string;
  value: number;
  tone?: "primary" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success-foreground"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary-soft text-primary";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

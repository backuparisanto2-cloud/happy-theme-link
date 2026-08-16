import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchLogs, type MessageLog } from "@/lib/db";
import { formatInTimezone } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Riwayat pengiriman — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Catatan setiap pesan pengingat WhatsApp: antre, terkirim, atau gagal, lengkap dengan waktu dan pesan galat.",
      },
      { property: "og:title", content: "Riwayat pengiriman — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Pantau status setiap pesan pengingat dan ulangi pengiriman yang gagal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogsPage,
});

const STATUS_TONE: Record<string, string> = {
  queued: "bg-secondary text-secondary-foreground",
  sending: "bg-warning/20 text-warning-foreground",
  sent: "bg-success/20 text-success-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function LogsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const logs = useQuery({ queryKey: ["logs"], queryFn: fetchLogs });

  const retry = useMutation({
    mutationFn: async (log: MessageLog) => {
      const { error } = await supabase
        .from("message_logs")
        .update({ status: "queued", error: null, scheduled_for: new Date().toISOString() })
        .eq("id", log.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pesan dimasukkan kembali ke antrean");
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (logs.data ?? []).filter((log) => status === "all" || log.status === status);

  return (
    <>
      <PageHeader
        title="Riwayat pengiriman"
        description="Setiap percobaan pengiriman tercatat lengkap dengan status dan galat."
        action={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="queued">Antre</SelectItem>
              <SelectItem value="sending">Mengirim</SelectItem>
              <SelectItem value="sent">Terkirim</SelectItem>
              <SelectItem value="failed">Gagal</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-3">
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Belum ada catatan pengiriman.
            </CardContent>
          </Card>
        )}
        {rows.map((log) => (
          <Card key={log.id}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{log.recipient_name || log.phone}</span>
                  <Badge className={STATUS_TONE[log.status] ?? ""} variant="secondary">
                    {log.status}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{log.message}</p>
                <p className="text-xs text-muted-foreground">
                  Dijadwalkan {formatInTimezone(new Date(log.scheduled_for), "Asia/Jakarta")}
                  {log.sent_at
                    ? ` · terkirim ${formatInTimezone(new Date(log.sent_at), "Asia/Jakarta")}`
                    : ""}
                  {` · ${log.attempts} percobaan`}
                </p>
                {log.error && <p className="text-xs text-destructive">{log.error}</p>}
              </div>
              {log.status === "failed" && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => retry.mutate(log)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ulangi
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

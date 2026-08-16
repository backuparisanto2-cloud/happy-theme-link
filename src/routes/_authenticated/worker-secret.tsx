import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { applyWorkerSecret, getWorkerSecretStatus } from "@/lib/worker-secret.functions";

export const Route = createFileRoute("/_authenticated/worker-secret")({
  head: () => ({
    meta: [
      { title: "Wizard WHATSAPP_WORKER_SECRET — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Buat nilai acak WHATSAPP_WORKER_SECRET, tulis otomatis ke .env aplikasi dan worker/.env, lalu validasi agar tidak mismatch.",
      },
      { property: "og:title", content: "Wizard WHATSAPP_WORKER_SECRET" },
      {
        property: "og:description",
        content: "Generate, tulis ke dua file .env, dan validasi kecocokan secret worker WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkerSecretWizard,
});

function WorkerSecretWizard() {
  const statusFn = useServerFn(getWorkerSecretStatus);
  const applyFn = useServerFn(applyWorkerSecret);
  const [manual, setManual] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const status = useQuery({
    queryKey: ["worker-secret-status"],
    queryFn: () => statusFn({ data: undefined }),
  });

  const apply = useMutation({
    mutationFn: (vars: { mode: "generate" | "manual"; secret?: string }) => applyFn({ data: vars }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan secret");
      } else {
        setRevealed(result.secret ?? null);
        setManual("");
        toast.success(`Secret ditulis ke ${result.written.join(" dan ")}`);
      }
      void status.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = status.data;
  const files = data?.files ?? [];
  const allSet = files.length > 0 && files.every((f) => f.hasSecret);
  const healthy = Boolean(data?.match && allSet && data?.problems.length === 0);

  const copy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Gagal menyalin, salin manual dari kotak di atas");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-3">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pengaturan
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <KeyRound className="h-5 w-5 text-primary" />
          Wizard secret worker
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Membuat nilai acak <code>WHATSAPP_WORKER_SECRET</code> lalu menuliskannya sekaligus ke{" "}
          <code>.env</code> aplikasi dan <code>worker/.env</code>, sehingga keduanya tidak mungkin berbeda.
        </p>
      </div>

      {/* Langkah 1 — status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">1. Status saat ini</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status.isFetching ? "animate-spin" : ""}`} />
            Periksa ulang
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status.isLoading ? (
            <p className="text-muted-foreground">Memeriksa file .env…</p>
          ) : status.isError ? (
            <p className="text-destructive">Gagal memeriksa: {(status.error as Error).message}</p>
          ) : !data?.writable ? (
            <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                Aplikasi ini sedang berjalan di hosting cloud yang tidak punya file <code>.env</code> permanen.
                Buka halaman ini setelah menjalankan aplikasi di komputer Windows Anda untuk memakai wizard.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{file.label}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{file.path}</p>
                    </div>
                    {file.hasSecret ? (
                      <Badge variant="secondary" className="shrink-0 gap-1 font-mono text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        {file.fingerprint}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        {file.exists ? "belum diisi" : "file belum ada"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              <div
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  healthy ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"
                }`}
              >
                {healthy ? (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="space-y-1">
                  <p className={healthy ? "font-medium text-foreground" : "font-medium text-foreground"}>
                    {healthy ? "Cocok — aplikasi dan worker memakai secret yang sama" : "Perlu tindakan"}
                  </p>
                  {data.problems.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {data.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Kode pendek di atas adalah sidik jari (hash) nilai, bukan secretnya. Sidik jari sama =
                    nilai sama.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Langkah 2 — generate / manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Buat &amp; tulis secret</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Cara paling aman: biarkan wizard membuat nilai acak 64 karakter dan menulisnya ke kedua file.
            </p>
            <Button
              className="gap-2"
              disabled={!data?.writable || apply.isPending}
              onClick={() => apply.mutate({ mode: "generate" })}
            >
              <KeyRound className="h-4 w-4" />
              {apply.isPending ? "Menulis…" : "Generate & tulis ke kedua .env"}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="manual-secret">Atau pakai nilai milik Anda sendiri</Label>
            <Input
              id="manual-secret"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="minimal 32 karakter, tanpa spasi"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Berguna kalau worker berjalan di komputer lain dan sudah punya nilai sendiri — nilai ini akan
              ditulis ke kedua file di sini.
            </p>
            <Button
              variant="outline"
              disabled={!data?.writable || apply.isPending || manual.trim().length < 32}
              onClick={() => apply.mutate({ mode: "manual", secret: manual.trim() })}
            >
              Simpan nilai ini
            </Button>
          </div>

          {revealed && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="font-medium text-foreground">Secret aktif (ditampilkan sekali)</p>
              <p className="break-all font-mono text-xs text-foreground">{revealed}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copy()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Simpan di password manager jika worker ada di komputer lain.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Langkah 3 — restart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Restart agar nilai terbaru dipakai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            File <code>.env</code> dibaca saat proses dimulai. Setelah menulis secret baru, hentikan lalu
            jalankan ulang aplikasi dan worker (atau <code>pm2 restart all</code>), kemudian tekan{" "}
            <span className="font-medium text-foreground">Periksa ulang</span> di langkah 1.
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/worker-setup">
              <BookOpen className="h-4 w-4" />
              Panduan deploy Windows 10
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
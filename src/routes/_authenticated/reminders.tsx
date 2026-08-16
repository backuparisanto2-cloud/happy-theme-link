import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BellRing, CalendarClock, Pause, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchContacts, fetchGroupMembers, fetchGroups, fetchReminders, type Reminder } from "@/lib/db";
import {
  computeNextRun,
  computeNextRuns,
  describeSchedule,
  formatInTimezone,
  getZonedParts,
  parseCron,
  TIMEZONES,
  zonedToUtc,
  type ScheduleType,
} from "@/lib/schedule";
import { useAuth } from "@/hooks/useAuth";


export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Pengingat — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Buat pengingat WhatsApp sekali kirim pada tanggal tertentu, atau berulang harian, mingguan, bulanan, dan cron kustom.",
      },
      { property: "og:title", content: "Pengingat — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Penjadwalan pesan WhatsApp yang sadar zona waktu, dengan aturan berulang fleksibel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersPage,
});

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface FormState {
  title: string;
  message: string;
  targetType: "contact" | "group";
  contactId: string;
  groupId: string;
  timezone: string;
  scheduleType: ScheduleType;
  runAtLocal: string;
  timeOfDay: string;
  weekdays: number[];
  dayOfMonth: number;
  cronExpression: string;
  startsAtLocal: string;
  endsAtLocal: string;
  maxOccurrences: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  targetType: "contact",
  contactId: "",
  groupId: "",
  timezone: "Asia/Jakarta",
  scheduleType: "once",
  runAtLocal: "",
  timeOfDay: "09:00",
  weekdays: [1],
  dayOfMonth: 1,
  cronExpression: "0 9 * * 1-5",
  startsAtLocal: "",
  endsAtLocal: "",
  maxOccurrences: "",
};

function localInputToUtc(value: string, timezone: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return zonedToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), timezone).toISOString();
}

function nowLocalInput(timezone: string): string {
  const p = getZonedParts(new Date(Date.now() + 3600_000), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function utcToLocalInput(iso: string | null, timezone: string): string {
  if (!iso) return "";
  const p = getZonedParts(new Date(iso), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function reminderToForm(reminder: Reminder): FormState {
  const tz = reminder.timezone || "Asia/Jakarta";
  return {
    title: reminder.title,
    message: reminder.message,
    targetType: reminder.target_type === "group" ? "group" : "contact",
    contactId: reminder.contact_id ?? "",
    groupId: reminder.group_id ?? "",
    timezone: tz,
    scheduleType: reminder.schedule_type as ScheduleType,
    runAtLocal: utcToLocalInput(reminder.run_at, tz),
    timeOfDay: reminder.time_of_day ?? "09:00",
    weekdays: reminder.weekdays?.length ? reminder.weekdays : [1],
    dayOfMonth: reminder.day_of_month ?? 1,
    cronExpression: reminder.cron_expression ?? "0 9 * * 1-5",
    startsAtLocal: utcToLocalInput(reminder.starts_at, tz),
    endsAtLocal: utcToLocalInput(reminder.ends_at, tz),
    maxOccurrences: reminder.max_occurrences ? String(reminder.max_occurrences) : "",
  };
}

function reminderToScheduleInput(reminder: Reminder) {
  return {
    scheduleType: reminder.schedule_type as ScheduleType,
    timezone: reminder.timezone,
    runAt: reminder.run_at,
    timeOfDay: reminder.time_of_day,
    weekdays: reminder.weekdays,
    dayOfMonth: reminder.day_of_month,
    cronExpression: reminder.cron_expression,
    startsAt: reminder.starts_at,
    endsAt: reminder.ends_at,
  };
}

function UpcomingRuns({ reminder }: { reminder: Reminder }) {
  const runs = useMemo(() => computeNextRuns(reminderToScheduleInput(reminder), 5), [reminder]);

  if (reminder.status !== "active") {
    return (
      <p className="text-xs text-muted-foreground">
        Jadwal dijeda — tidak ada pengiriman berikutnya sampai dilanjutkan.
      </p>
    );
  }

  if (!runs.length) {
    return <p className="text-xs text-muted-foreground">Tidak ada jadwal berikutnya.</p>;
  }

  return (
    <ol className="space-y-1">
      {runs.map((run, index) => (
        <li key={run.toISOString()} className="flex items-center gap-2 text-xs">
          <CalendarClock
            className={index === 0 ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 text-muted-foreground"}
          />
          <span className={index === 0 ? "font-medium" : "text-muted-foreground"}>
            {formatInTimezone(run, reminder.timezone)}
          </span>
          {index === 0 && <span className="text-[11px] text-muted-foreground">berikutnya</span>}
        </li>
      ))}
    </ol>
  );
}

function RemindersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: fetchReminders });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const members = useQuery({ queryKey: ["group-members"], queryFn: fetchGroupMembers });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Reminder | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const scheduleInput = useMemo(
    () => ({
      scheduleType: form.scheduleType,
      timezone: form.timezone,
      runAt: localInputToUtc(form.runAtLocal, form.timezone),
      timeOfDay: form.timeOfDay,
      weekdays: form.weekdays,
      dayOfMonth: form.dayOfMonth,
      cronExpression: form.cronExpression,
      startsAt: localInputToUtc(form.startsAtLocal, form.timezone),
      endsAt: localInputToUtc(form.endsAtLocal, form.timezone),
    }),
    [form],
  );

  const previewRuns = useMemo(() => computeNextRuns(scheduleInput, 5), [scheduleInput]);
  const preview = previewRuns[0] ?? null;

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, runAtLocal: nowLocalInput(EMPTY_FORM.timezone) });
    setOpen(true);
  }

  function openEdit(reminder: Reminder) {
    setEditing(reminder);
    setForm(reminderToForm(reminder));
    setOpen(true);
  }

  const cronValid = form.scheduleType !== "cron" || Boolean(parseCron(form.cronExpression));

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak ditemukan");
      const nextRun = computeNextRun(scheduleInput);
      if (!nextRun) throw new Error("Jadwal tidak menghasilkan waktu kirim di masa depan");

      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        target_type: form.targetType,
        contact_id: form.targetType === "contact" ? form.contactId : null,
        group_id: form.targetType === "group" ? form.groupId : null,
        timezone: form.timezone,
        schedule_type: form.scheduleType,
        run_at: scheduleInput.runAt,
        time_of_day: form.scheduleType === "once" ? null : form.timeOfDay,
        weekdays: form.scheduleType === "weekly" ? form.weekdays : [],
        day_of_month: form.scheduleType === "monthly" ? form.dayOfMonth : null,
        cron_expression: form.scheduleType === "cron" ? form.cronExpression.trim() : null,
        starts_at: scheduleInput.startsAt,
        ends_at: scheduleInput.endsAt,
        max_occurrences: form.maxOccurrences ? Number(form.maxOccurrences) : null,
        next_run_at: nextRun.toISOString(),
      };

      if (editing) {
        const { error } = await supabase
          .from("reminders")
          .update({ ...payload, status: editing.status === "completed" ? "active" : editing.status })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
        return "updated" as const;
      }

      const { error } = await supabase
        .from("reminders")
        .insert({ ...payload, user_id: user.id, status: "active" });
      if (error) throw new Error(error.message);
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "updated" ? "Pengingat diperbarui" : "Pengingat dijadwalkan");
      setForm(EMPTY_FORM);
      setEditing(null);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const toggleStatus = useMutation({
    mutationFn: async (reminder: Reminder) => {
      const nextStatus = reminder.status === "active" ? "paused" : "active";
      const nextRun =
        nextStatus === "active"
          ? computeNextRun({
              scheduleType: reminder.schedule_type as ScheduleType,
              timezone: reminder.timezone,
              runAt: reminder.run_at,
              timeOfDay: reminder.time_of_day,
              weekdays: reminder.weekdays,
              dayOfMonth: reminder.day_of_month,
              cronExpression: reminder.cron_expression,
              startsAt: reminder.starts_at,
              endsAt: reminder.ends_at,
            })
          : null;
      const { error } = await supabase
        .from("reminders")
        .update({ status: nextStatus, next_run_at: nextRun ? nextRun.toISOString() : null })
        .eq("id", reminder.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pengingat dihapus");
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendNow = useMutation({
    mutationFn: async (reminder: Reminder) => {
      if (!user) throw new Error("Sesi tidak ditemukan");
      const recipientIds =
        reminder.target_type === "group"
          ? (members.data ?? []).filter((m) => m.group_id === reminder.group_id).map((m) => m.contact_id)
          : reminder.contact_id
            ? [reminder.contact_id]
            : [];
      const recipients = (contacts.data ?? []).filter((c) => recipientIds.includes(c.id));
      if (!recipients.length) throw new Error("Tidak ada penerima untuk pengingat ini");

      const { error } = await supabase.from("message_logs").insert(
        recipients.map((contact) => ({
          user_id: user.id,
          reminder_id: reminder.id,
          contact_id: contact.id,
          recipient_name: contact.name,
          phone: contact.phone,
          message: reminder.message.replace(/\{name\}/g, contact.name),
          scheduled_for: new Date().toISOString(),
          status: "queued",
        })),
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pesan dimasukkan ke antrean");
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const targetLabel = (reminder: Reminder) => {
    if (reminder.target_type === "group") {
      return groups.data?.find((g) => g.id === reminder.group_id)?.name ?? "Grup";
    }
    return contacts.data?.find((c) => c.id === reminder.contact_id)?.name ?? "Kontak";
  };

  const canSubmit =
    form.title.trim() &&
    form.message.trim() &&
    (form.targetType === "contact" ? form.contactId : form.groupId) &&
    cronValid &&
    (form.scheduleType !== "once" || form.runAtLocal);

  return (
    <>
      <PageHeader
        title="Pengingat"
        description="Sekali kirim pada tanggal tertentu, atau berulang harian, mingguan, bulanan, dan cron kustom."
        action={
          <>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Buat pengingat
            </Button>
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setEditing(null);
              }}
            >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Ubah pengingat" : "Pengingat baru"}</DialogTitle>
              </DialogHeader>


              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="r-title">Judul</Label>
                  <Input
                    id="r-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Pengingat pembayaran"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="r-message">Pesan</Label>
                  <Textarea
                    id="r-message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Halo {name}, ini pengingat untuk..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Gunakan {"{name}"} untuk menyisipkan nama penerima.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tujuan</Label>
                    <Select
                      value={form.targetType}
                      onValueChange={(value: "contact" | "group") =>
                        setForm({ ...form, targetType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact">Kontak</SelectItem>
                        <SelectItem value="group">Grup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{form.targetType === "contact" ? "Kontak" : "Grup"}</Label>
                    <Select
                      value={form.targetType === "contact" ? form.contactId : form.groupId}
                      onValueChange={(value) =>
                        setForm(
                          form.targetType === "contact"
                            ? { ...form, contactId: value }
                            : { ...form, groupId: value },
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(form.targetType === "contact" ? (contacts.data ?? []) : (groups.data ?? [])).map(
                          (item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Zona waktu</Label>
                    <Select
                      value={form.timezone}
                      onValueChange={(value) => setForm({ ...form, timezone: value })}
                    >
                      <SelectTrigger>
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
                    <Label>Tipe jadwal</Label>
                    <Select
                      value={form.scheduleType}
                      onValueChange={(value: ScheduleType) => setForm({ ...form, scheduleType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Sekali (tanggal spesifik)</SelectItem>
                        <SelectItem value="daily">Harian</SelectItem>
                        <SelectItem value="weekly">Mingguan</SelectItem>
                        <SelectItem value="monthly">Bulanan</SelectItem>
                        <SelectItem value="cron">Cron kustom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.scheduleType === "once" && (
                  <div className="space-y-2">
                    <Label htmlFor="r-runat">Tanggal & jam kirim</Label>
                    <Input
                      id="r-runat"
                      type="datetime-local"
                      value={form.runAtLocal}
                      onChange={(e) => setForm({ ...form, runAtLocal: e.target.value })}
                    />
                  </div>
                )}

                {(form.scheduleType === "daily" ||
                  form.scheduleType === "weekly" ||
                  form.scheduleType === "monthly") && (
                  <div className="space-y-2">
                    <Label htmlFor="r-time">Jam kirim</Label>
                    <Input
                      id="r-time"
                      type="time"
                      value={form.timeOfDay}
                      onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
                    />
                  </div>
                )}

                {form.scheduleType === "weekly" && (
                  <div className="space-y-2">
                    <Label>Hari</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_LABELS.map((label, index) => {
                        const active = form.weekdays.includes(index);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                weekdays: active
                                  ? form.weekdays.filter((d) => d !== index)
                                  : [...form.weekdays, index].sort(),
                              })
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.scheduleType === "monthly" && (
                  <div className="space-y-2">
                    <Label htmlFor="r-dom">Tanggal setiap bulan</Label>
                    <Input
                      id="r-dom"
                      type="number"
                      min={1}
                      max={31}
                      value={form.dayOfMonth}
                      onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                    />
                  </div>
                )}

                {form.scheduleType === "cron" && (
                  <div className="space-y-2">
                    <Label htmlFor="r-cron">Ekspresi cron</Label>
                    <Input
                      id="r-cron"
                      value={form.cronExpression}
                      onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                      placeholder="0 9 * * 1-5"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: menit jam tanggal bulan hari. {cronValid ? "" : "Ekspresi tidak valid."}
                    </p>
                  </div>
                )}

                {form.scheduleType !== "once" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="r-start">Mulai (opsional)</Label>
                      <Input
                        id="r-start"
                        type="datetime-local"
                        value={form.startsAtLocal}
                        onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-end">Berakhir (opsional)</Label>
                      <Input
                        id="r-end"
                        type="datetime-local"
                        value={form.endsAtLocal}
                        onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="r-max">Maksimum pengiriman (opsional)</Label>
                      <Input
                        id="r-max"
                        type="number"
                        min={1}
                        value={form.maxOccurrences}
                        onChange={(e) => setForm({ ...form, maxOccurrences: e.target.value })}
                        placeholder="tanpa batas"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <p className="text-muted-foreground">
                    Pratinjau jadwal ({form.timezone})
                  </p>
                  {previewRuns.length ? (
                    <ol className="space-y-1">
                      {previewRuns.map((run, index) => (
                        <li key={run.toISOString()} className="flex items-center gap-2 text-xs">
                          <CalendarClock
                            className={
                              index === 0
                                ? "h-3.5 w-3.5 text-primary"
                                : "h-3.5 w-3.5 text-muted-foreground"
                            }
                          />
                          <span className={index === 0 ? "font-medium" : "text-muted-foreground"}>
                            {formatInTimezone(run, form.timezone)}
                          </span>
                          {index === 0 && (
                            <span className="text-[11px] text-muted-foreground">berikutnya</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Belum ada waktu kirim di masa depan — sesuaikan jadwalnya.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={!canSubmit || !preview || save.isPending}
                >
                  {editing ? "Simpan perubahan" : "Jadwalkan"}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </>
        }
      />


      <div className="space-y-3">
        {(reminders.data ?? []).length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <BellRing className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada pengingat. Buat jadwal pertama Anda.
              </p>
            </CardContent>
          </Card>
        )}

        {(reminders.data ?? []).map((reminder) => (
          <Card key={reminder.id}>
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{reminder.title}</h2>
                  <Badge
                    variant="secondary"
                    className={
                      reminder.status === "active"
                        ? "bg-success/20 text-success-foreground"
                        : reminder.status === "paused"
                          ? "bg-warning/20 text-warning-foreground"
                          : ""
                    }
                  >
                    {reminder.status}
                  </Badge>
                  <Badge variant="outline">{targetLabel(reminder)}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{reminder.message}</p>
                <p className="text-xs text-muted-foreground">
                  {describeSchedule({
                    scheduleType: reminder.schedule_type as ScheduleType,
                    timezone: reminder.timezone,
                    runAt: reminder.run_at,
                    timeOfDay: reminder.time_of_day,
                    weekdays: reminder.weekdays,
                    dayOfMonth: reminder.day_of_month,
                    cronExpression: reminder.cron_expression,
                  })}
                  {" · "}
                  {reminder.timezone}
                  {reminder.next_run_at
                    ? ` · berikutnya ${formatInTimezone(new Date(reminder.next_run_at), reminder.timezone)}`
                    : ""}
                </p>

                <button
                  type="button"
                  onClick={() => setExpanded(expanded === reminder.id ? null : reminder.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {expanded === reminder.id ? "Sembunyikan jadwal" : "Lihat 5 jadwal berikutnya"}
                </button>

                {expanded === reminder.id && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <UpcomingRuns reminder={reminder} />
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => sendNow.mutate(reminder)}>
                  <Send className="h-3.5 w-3.5" />
                  Kirim sekarang
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => openEdit(reminder)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Ubah
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => toggleStatus.mutate(reminder)}
                >
                  {reminder.status === "active" ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Jeda
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Lanjutkan
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus ${reminder.title}`}
                  onClick={() => setPendingDelete(reminder)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengingat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; akan dihapus permanen beserta jadwalnya. Riwayat
              pengiriman yang sudah ada tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>

  );
}

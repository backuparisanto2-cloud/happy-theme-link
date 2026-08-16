import { createFileRoute } from "@tanstack/react-router";

import { computeNextRun, type ScheduleType } from "@/lib/schedule";

/**
 * Cron endpoint: finds active reminders whose next run time has passed,
 * enqueues one message per recipient, then rolls the schedule forward.
 */
export const Route = createFileRoute("/api/public/hooks/dispatch-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkSchedulerSecret, getServiceDb } = await import("@/lib/service-db.server");
        if (!checkSchedulerSecret(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = await getServiceDb();
        const now = new Date();

        const { data: due, error } = await db
          .from("reminders")
          .select("*")
          .eq("status", "active")
          .not("next_run_at", "is", null)
          .lte("next_run_at", now.toISOString())
          .limit(200);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        let queued = 0;

        for (const reminder of due ?? []) {
          let contactIds: string[] = [];
          if (reminder.target_type === "group" && reminder.group_id) {
            const { data: members } = await db
              .from("group_members")
              .select("contact_id")
              .eq("group_id", reminder.group_id);
            contactIds = (members ?? []).map((m) => m.contact_id);
          } else if (reminder.contact_id) {
            contactIds = [reminder.contact_id];
          }

          if (contactIds.length) {
            const { data: contacts } = await db
              .from("contacts")
              .select("id, name, phone")
              .in("id", contactIds);

            const rows = (contacts ?? []).map((contact) => ({
              user_id: reminder.user_id,
              reminder_id: reminder.id,
              contact_id: contact.id,
              recipient_name: contact.name,
              phone: contact.phone,
              message: reminder.message.replace(/\{name\}/g, contact.name),
              scheduled_for: reminder.next_run_at ?? now.toISOString(),
              status: "queued",
            }));

            if (rows.length) {
              const { error: insertError } = await db.from("message_logs").insert(rows);
              if (!insertError) queued += rows.length;
            }
          }

          const occurrenceCount = reminder.occurrence_count + 1;
          const reachedLimit =
            reminder.max_occurrences != null && occurrenceCount >= reminder.max_occurrences;

          const nextRun = reachedLimit
            ? null
            : computeNextRun(
                {
                  scheduleType: reminder.schedule_type as ScheduleType,
                  timezone: reminder.timezone,
                  runAt: reminder.run_at,
                  timeOfDay: reminder.time_of_day,
                  weekdays: reminder.weekdays,
                  dayOfMonth: reminder.day_of_month,
                  cronExpression: reminder.cron_expression,
                  startsAt: reminder.starts_at,
                  endsAt: reminder.ends_at,
                },
                now,
              );

          await db
            .from("reminders")
            .update({
              occurrence_count: occurrenceCount,
              next_run_at: nextRun ? nextRun.toISOString() : null,
              status: nextRun ? "active" : "completed",
            })
            .eq("id", reminder.id);
        }

        return Response.json({ processed: due?.length ?? 0, queued });
      },
    },
  },
});

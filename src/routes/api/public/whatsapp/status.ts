import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const StatusSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["sent", "failed", "queued"]),
        error: z.string().max(1000).optional().nullable(),
      }),
    )
    .min(1)
    .max(100),
});

/** Worker bridge: report delivery outcome for previously pulled messages. */
export const Route = createFileRoute("/api/public/whatsapp/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkWorkerSecret, getServiceDb } = await import("@/lib/service-db.server");
        if (!checkWorkerSecret(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsed = StatusSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const db = await getServiceDb();
        let updated = 0;

        for (const result of parsed.data.results) {
          const { data: existing } = await db
            .from("message_logs")
            .select("attempts")
            .eq("id", result.id)
            .maybeSingle();

          const { error } = await db
            .from("message_logs")
            .update({
              status: result.status,
              error: result.error ?? null,
              attempts: (existing?.attempts ?? 0) + 1,
              sent_at: result.status === "sent" ? new Date().toISOString() : null,
            })
            .eq("id", result.id);

          if (!error) updated += 1;
        }

        return Response.json({ updated });
      },
    },
  },
});

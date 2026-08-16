import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker bridge: a self-hosted whatsapp-web.js worker calls this to fetch
 * queued messages. Protected by the WHATSAPP_WORKER_SECRET header.
 */
export const Route = createFileRoute("/api/public/whatsapp/pull")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["WHATSAPP_WORKER_SECRET"];
        if (!secret || request.headers.get("x-worker-secret") !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? "20");
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

        const { data, error } = await supabaseAdmin
          .from("message_logs")
          .select("id, phone, message, recipient_name, scheduled_for, attempts")
          .eq("status", "queued")
          .lte("scheduled_for", new Date().toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(limit);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        const ids = (data ?? []).map((row) => row.id);
        if (ids.length) {
          await supabaseAdmin.from("message_logs").update({ status: "sending" }).in("id", ids);
        }

        return Response.json({ messages: data ?? [] });
      },
    },
  },
});

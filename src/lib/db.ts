import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type MessageLog = Database["public"]["Tables"]["message_logs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchContacts(): Promise<Contact[]> {
  return unwrap(await supabase.from("contacts").select("*").order("name"));
}

export async function fetchGroups(): Promise<Group[]> {
  return unwrap(await supabase.from("groups").select("*").order("name"));
}

export async function fetchGroupMembers(): Promise<GroupMember[]> {
  return unwrap(await supabase.from("group_members").select("*"));
}

export async function fetchReminders(): Promise<Reminder[]> {
  return unwrap(
    await supabase.from("reminders").select("*").order("next_run_at", { ascending: true, nullsFirst: false }),
  );
}

export async function fetchLogs(): Promise<MessageLog[]> {
  return unwrap(
    await supabase.from("message_logs").select("*").order("created_at", { ascending: false }).limit(300),
  );
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

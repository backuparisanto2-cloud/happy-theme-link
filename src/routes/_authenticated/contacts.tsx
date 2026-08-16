import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchContacts, fetchGroupMembers, fetchGroups } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Kontak & Grup — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Kelola daftar kontak WhatsApp beserta nomor internasional dan kelompokkan mereka ke dalam grup penerima.",
      },
      { property: "og:title", content: "Kontak & Grup — WA Reminder Studio" },
      {
        property: "og:description",
        content: "Simpan penerima pengingat WhatsApp dan susun grup untuk pengiriman massal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Kontak & Grup"
        description="Penerima pengingat Anda, tersimpan rapi dan siap dijadwalkan."
      />
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Kontak</TabsTrigger>
          <TabsTrigger value="groups">Grup</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-6">
          <ContactsTab />
        </TabsContent>
        <TabsContent value="groups" className="mt-6">
          <GroupsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ContactsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak ditemukan");
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Kontak disimpan");
      setForm({ name: "", phone: "", notes: "" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Kontak dihapus");
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah kontak
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontak baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nama</Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Budi Santoso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Nomor WhatsApp</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+628123456789"
              />
              <p className="text-xs text-muted-foreground">Gunakan format internasional, contoh +62.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-notes">Catatan</Label>
              <Textarea
                id="contact-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.name.trim() || !form.phone.trim() || create.isPending}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(contacts.data ?? []).length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Belum ada kontak.
            </CardContent>
          </Card>
        )}
        {(contacts.data ?? []).map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="truncate font-medium">{contact.name}</p>
                <p className="text-sm text-muted-foreground">{contact.phone}</p>
                {contact.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{contact.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Hapus ${contact.name}`}
                onClick={() => remove.mutate(contact.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GroupsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const members = useQuery({ queryKey: ["group-members"], queryFn: fetchGroupMembers });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak ditemukan");
      const { data, error } = await supabase
        .from("groups")
        .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null })
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (selected.length) {
        const { error: memberError } = await supabase.from("group_members").insert(
          selected.map((contactId) => ({
            user_id: user.id,
            group_id: data.id,
            contact_id: contactId,
          })),
        );
        if (memberError) throw new Error(memberError.message);
      }
    },
    onSuccess: () => {
      toast.success("Grup dibuat");
      setName("");
      setDescription("");
      setSelected([]);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["group-members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Grup dihapus");
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["group-members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah grup
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grup baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nama grup</Label>
              <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-desc">Deskripsi</Label>
              <Input
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Anggota</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {(contacts.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Tambahkan kontak terlebih dahulu.</p>
                )}
                {(contacts.data ?? []).map((contact) => (
                  <label key={contact.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={selected.includes(contact.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, contact.id] : prev.filter((id) => id !== contact.id),
                        )
                      }
                    />
                    <span>{contact.name}</span>
                    <span className="text-muted-foreground">{contact.phone}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(groups.data ?? []).length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Belum ada grup.
            </CardContent>
          </Card>
        )}
        {(groups.data ?? []).map((group) => {
          const count = (members.data ?? []).filter((m) => m.group_id === group.id).length;
          return (
            <Card key={group.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus ${group.name}`}
                  onClick={() => remove.mutate(group.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="gap-1">
                  <UsersRound className="h-3 w-3" />
                  {count} anggota
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

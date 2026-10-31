import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SavedKind = "trip" | "preflight";
export interface SavedRow {
  id: string;
  kind: SavedKind;
  title: string;
  travel_date: string | null;
  data: Json;
  created_at: string;
}

export const savedQueryKey = (userId: string) => ["saved-trips", userId] as const;
export const profileQueryKey = (userId: string) => ["profile", userId] as const;

export async function listSaved(): Promise<SavedRow[]> {
  const { data, error } = await supabase
    .from("saved_trips")
    .select("id,kind,title,travel_date,data,created_at")
    .order("travel_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as SavedRow[];
}

/** Each saved item carries a stable key (route + dates) so saving twice updates instead of duplicating. */
export async function findSaved(kind: SavedKind, key: string) {
  const { data, error } = await supabase
    .from("saved_trips")
    .select("id")
    .eq("kind", kind)
    .eq("data->>key", key)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function saveItem(item: {
  id?: string | null;
  userId: string;
  kind: SavedKind;
  title: string;
  travelDate: string | null;
  data: { key: string } & Record<string, unknown>;
}) {
  const row = {
    user_id: item.userId,
    kind: item.kind,
    title: item.title.slice(0, 200),
    travel_date: item.travelDate,
    data: item.data as unknown as Json,
  };
  const query = item.id
    ? supabase.from("saved_trips").update(row).eq("id", item.id).select("id").single()
    : supabase.from("saved_trips").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return data.id;
}

export async function deleteSaved(id: string) {
  const { error } = await supabase.from("saved_trips").delete().eq("id", id);
  if (error) throw error;
}

export interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  photo: string | null;
}

/** Uploaded photos live in the private avatars bucket as "avatars/<user>/…"; sign-in photos are https URLs. */
export async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const avatar = data?.avatar_url ?? null;
  let photo: string | null = avatar;
  if (avatar?.startsWith("avatars/")) {
    const signed = await supabase.storage.from("avatars").createSignedUrl(avatar.slice(8), 3600);
    photo = signed.data?.signedUrl ?? null;
  }
  return { display_name: data?.display_name ?? null, avatar_url: avatar, photo };
}

export async function updateProfile(userId: string, values: { display_name?: string; avatar_url?: string }) {
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...values });
  if (error) throw error;
}

/** Shrinks the picked photo to a 384px square JPEG on the device before upload. */
export async function uploadAvatar(userId: string, file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 384;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Photo could not be prepared");
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  await updateProfile(userId, { avatar_url: `avatars/${path}` });
}

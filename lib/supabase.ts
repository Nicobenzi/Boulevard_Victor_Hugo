import { createClient } from "@supabase/supabase-js";

// Clé « publishable » : publique par design, la sécurité est assurée par RLS.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://cjnnzmfbqybgcmmvrodx.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "sb_publishable_maSkf1bUdO7MTgKcr6PU7w_ay7fIe1S"
);

export const PLATFORMS: Record<string, { short: string; color: string; name: string }> = {
  instagram: { short: "IG", color: "#d64d7a", name: "Instagram" },
  tiktok: { short: "TT", color: "#7ac0d6", name: "TikTok" },
  youtube: { short: "YT", color: "#d65454", name: "YouTube" },
};

export const STATUS_FR: Record<string, string> = {
  draft: "brouillon", ready: "prêt", published: "publié", cancelled: "annulé",
};

export function bucketFor(mime: string) {
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audios";
  return "images";
}

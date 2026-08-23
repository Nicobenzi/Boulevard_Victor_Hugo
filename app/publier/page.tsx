"use client";
import { useEffect, useState } from "react";
import { supabase, PLATFORMS, STATUS_FR } from "@/lib/supabase";

export default function Publier() {
  const [pubs, setPubs] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("publications")
      .select("*, poems(id, title, author), assets:video_asset_id(id, title, storage_bucket, storage_path)")
      .in("status", ["draft", "ready", "published"]).order("scheduled_at");
    setPubs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(p: any, status: string) {
    const patch: any = { status };
    if (status === "published") {
      const url = prompt("URL de la publication (optionnel) :") ?? "";
      patch.published_url = url || null;
      patch.published_at = new Date().toISOString();
    }
    await supabase.from("publications").update(patch).eq("id", p.id);
    load();
  }

  async function saveCaption(p: any, caption: string) {
    await supabase.from("publications").update({ caption }).eq("id", p.id);
  }

  async function attachVideo(p: any) {
    const { data: vids } = await supabase.from("assets").select("id, title").eq("kind", "video").eq("poem_id", p.poems.id);
    if (!vids?.length) { alert("Aucune vidéo liée à ce poème dans la bibliothèque."); return; }
    const choice = prompt("Numéro de la vidéo :\n" + vids.map((v, i) => `${i + 1}. ${v.title}`).join("\n"));
    const v = vids[Number(choice) - 1];
    if (v) { await supabase.from("publications").update({ video_asset_id: v.id }).eq("id", p.id); load(); }
  }

  async function download(p: any) {
    const { data } = await supabase.storage.from(p.assets.storage_bucket).createSignedUrl(p.assets.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const upcoming = pubs.filter((p) => p.status !== "published");
  const done = pubs.filter((p) => p.status === "published").slice(-5);

  return (
    <div>
      <h1 className="font-serif2 text-3xl mb-6">À publier</h1>
      <div className="grid gap-4">
        {upcoming.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: PLATFORMS[p.platform].color + "33", color: PLATFORMS[p.platform].color }}>{PLATFORMS[p.platform].name}</span>
              <span className="font-serif2 text-xl">{p.poems?.title}</span>
              <span style={{ color: "var(--ink-dim)" }}>{p.poems?.author}</span>
              <span className="ml-auto text-sm" style={{ color: "var(--ink-dim)" }}>
                {new Date(p.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {new Date(p.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="label">{STATUS_FR[p.status]}</span>
            </div>
            <textarea rows={3} defaultValue={p.caption} placeholder="Caption + hashtags…" onBlur={(e) => saveCaption(p, e.target.value)} className="mb-3" />
            <div className="flex gap-2 flex-wrap">
              <button className="btn2 text-xs" onClick={async () => { await navigator.clipboard.writeText(p.caption ?? ""); setCopied(p.id); setTimeout(() => setCopied(null), 1500); }}>
                {copied === p.id ? "copié ✓" : "copier la caption"}</button>
              {p.assets ? <button className="btn2 text-xs" onClick={() => download(p)}>télécharger la vidéo</button>
                : <button className="btn2 text-xs" onClick={() => attachVideo(p)}>lier une vidéo</button>}
              {p.status === "draft" && <button className="btn2 text-xs" onClick={() => setStatus(p, "ready")}>marquer prêt</button>}
              <button className="btn text-xs" onClick={() => setStatus(p, "published")}>✓ publié</button>
              <button className="btn2 text-xs" onClick={() => setStatus(p, "cancelled")}>annuler</button>
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <p style={{ color: "var(--ink-dim)" }}>Rien en attente — programme une publication depuis le calendrier.</p>}
      </div>

      {done.length > 0 && (
        <div className="mt-10">
          <div className="label mb-2">Publiées récemment</div>
          {done.map((p) => (
            <div key={p.id} className="flex gap-3 text-sm py-1" style={{ color: "var(--ink-dim)" }}>
              <span>{PLATFORMS[p.platform].short}</span><span>{p.poems?.title}</span>
              {p.published_url && <a href={p.published_url} target="_blank" style={{ color: "var(--gold)" }}>voir ↗</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

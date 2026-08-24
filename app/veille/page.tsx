"use client";
import { useEffect, useState } from "react";
import { supabase, PLATFORMS } from "@/lib/supabase";

const RATING = ["vu", "intéressant", "à reprendre"];

// La plateforme se déduit de l'URL : un lien collé suffit.
function platformOf(url: string) {
  const u = url.toLowerCase();
  if (u.includes("instagram.")) return "instagram";
  if (u.includes("tiktok.")) return "tiktok";
  if (u.includes("youtube.") || u.includes("youtu.be")) return "youtube";
  return "autre";
}
function accountOf(url: string) {
  const m = url.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._-]+)/);
  return m ? "@" + m[1] : "";
}

export default function Veille() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ url: "", account: "", title: "", note: "", tags: "", rating: 1 });
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from("inspirations").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null); setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: any) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("inspirations").insert({
      url: form.url,
      platform: platformOf(form.url),
      account: form.account || accountOf(form.url) || null,
      title: form.title || null,
      note: form.note || null,
      tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      rating: Number(form.rating),
      created_by: user?.id,
    });
    if (error) { setErr(error.message); return; }
    setForm({ url: "", account: "", title: "", note: "", tags: "", rating: 1 });
    setAdding(false); load();
  }

  async function setRating(it: any, r: number) {
    await supabase.from("inspirations").update({ rating: r }).eq("id", it.id);
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, rating: r } : x)));
  }

  async function remove(it: any) {
    await supabase.from("inspirations").delete().eq("id", it.id);
    setConfirmId(null); load();
  }

  const allTags = Array.from(new Set(items.flatMap((i) => i.tags ?? []))).sort();
  const shown = filter ? items.filter((i) => (i.tags ?? []).includes(filter)) : items;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="font-serif2 text-3xl">Veille</h1>
        <span className="text-sm" style={{ color: "var(--ink-dim)" }}>{items.length} référence{items.length > 1 ? "s" : ""}</span>
        <button className="btn ml-auto" onClick={() => setAdding(!adding)}>+ Ajouter</button>
      </div>

      {err && <div className="card mb-6" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Erreur : {err}</div>}

      {adding && (
        <form onSubmit={add} className="card mb-6 grid gap-3">
          <div><div className="label mb-1">Lien</div>
            <input required type="url" placeholder="https://…" value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })} />
            {form.url && (
              <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                {PLATFORMS[platformOf(form.url)]?.name ?? "Autre"}
                {accountOf(form.url) && ` · ${accountOf(form.url)}`} — détecté depuis le lien
              </p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="label mb-1">Compte (si non détecté)</div>
              <input placeholder="@lecompte" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} /></div>
            <div><div className="label mb-1">Mots-clés (séparés par des virgules)</div>
              <input placeholder="typo, face-camera, montage" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          </div>
          <div><div className="label mb-1">De quoi il s'agit</div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><div className="label mb-1">Ce qu'on en retient</div>
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div><div className="label mb-1">Intérêt</div>
            <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
              {RATING.map((r, i) => <option key={i} value={i}>{r}</option>)}
            </select></div>
          <button className="btn">Ajouter</button>
        </form>
      )}

      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button onClick={() => setFilter(null)} className="text-xs rounded-full px-3 py-1"
            style={{ border: `1px solid ${filter === null ? "var(--encre)" : "var(--line)"}`, color: filter === null ? "var(--ink)" : "var(--ink-dim)" }}>
            tout
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setFilter(filter === t ? null : t)} className="text-xs rounded-full px-3 py-1"
              style={{ border: `1px solid ${filter === t ? "var(--encre)" : "var(--line)"}`, color: filter === t ? "var(--ink)" : "var(--ink-dim)" }}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {shown.map((it) => (
          <div key={it.id} className="card">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              {/* ⚠ Cette page portait encore le défaut corrigé ailleurs le 24/08 : la couleur de
                  marque en TEXTE sur son propre aplat à 20 % — TikTok tombait à 1,77 pour un
                  seuil de 4,5. `.pastille` fait de la couleur un point, et le texte reste en
                  `--ink`. La couleur informe sans avoir à être lue. */}
              {PLATFORMS[it.platform]
                ? <span className="pastille">
                    <span className="point" style={{ background: PLATFORMS[it.platform].color }} />
                    {PLATFORMS[it.platform].name}</span>
                : <span className="label">autre</span>}
              {it.account && <span className="font-serif2 text-lg">{it.account}</span>}
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs"
                style={{ color: "var(--encre)" }}>ouvrir ↗</a>
              <div className="ml-auto flex gap-1">
                {RATING.map((r, i) => (
                  <button key={i} onClick={() => setRating(it, i)} title={r}
                    className="text-xs rounded px-2 py-0.5"
                    style={{ border: `1px solid ${it.rating === i ? "var(--encre)" : "var(--line)"}`,
                             color: it.rating === i ? "var(--encre)" : "var(--ink-dim)" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {it.title && <div className="text-sm mb-1">{it.title}</div>}
            {it.note && <p className="text-sm" style={{ color: "var(--ink-dim)" }}>{it.note}</p>}
            <div className="flex gap-2 flex-wrap mt-2 items-center">
              {(it.tags ?? []).map((t: string) => (
                <span key={t} className="text-xs" style={{ color: "var(--gold)" }}>#{t}</span>
              ))}
              {confirmId === it.id
                ? <button className="btn2 text-xs ml-auto" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={() => remove(it)}>confirmer ?</button>
                : <button className="btn2 text-xs ml-auto" onClick={() => setConfirmId(it.id)}>✕</button>}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p style={{ color: "var(--ink-dim)" }}>
            {items.length === 0
              ? "Rien encore — colle le lien d'une vidéo ou d'un compte qui t'a marqué."
              : "Aucune référence avec ce mot-clé."}
          </p>
        )}
      </div>
    </div>
  );
}

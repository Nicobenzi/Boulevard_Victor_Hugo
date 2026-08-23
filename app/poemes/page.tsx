"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STATUSES: Record<string, string> = { idea: "idée", recorded: "enregistré", edited: "monté", scheduled: "programmé", published: "publié" };
const JOB_FR: Record<string, string> = { queued: "en file d'attente", running: "rendu en cours…", done: "terminé ✓", error: "erreur" };

export default function Poemes() {
  const [poems, setPoems] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [creating, setCreating] = useState(false);
  const [newPoem, setNewPoem] = useState<any>({});
  const [pAssets, setPAssets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [gen, setGen] = useState({ audio_asset_id: "", image_asset_id: "", style: "musee" });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Pour l'étape suivante, dérivée des données plutôt que saisie à la main.
  const [kindsByPoem, setKindsByPoem] = useState<Record<string, string[]>>({});
  const [pubs, setPubs] = useState<any[]>([]);

  async function load() {
    const { data, error } = await supabase.from("poems").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setPoems(data ?? []);

    const { data: a } = await supabase.from("assets").select("poem_id, kind");
    const map: Record<string, string[]> = {};
    (a ?? []).forEach((x) => { if (x.poem_id) (map[x.poem_id] ??= []).push(x.kind); });
    setKindsByPoem(map);

    const { data: pu } = await supabase.from("publications").select("poem_id, status").neq("status", "cancelled");
    setPubs(pu ?? []);
  }
  useEffect(() => { load(); }, []);

  // « Où en est ce poème ? » — déduit de ce qui existe réellement en base,
  // plutôt que du champ `status` saisi à la main (qui dérive dès qu'on l'oublie).
  function nextStep(p: any): { label: string; done: boolean } {
    const kinds = kindsByPoem[p.id] ?? [];
    const mine = pubs.filter((x) => x.poem_id === p.id);
    if (!p.body?.trim()) return { label: "coller le texte", done: false };
    if (!kinds.includes("audio")) return { label: "enregistrer la voix", done: false };
    if (!kinds.includes("video")) return { label: "générer la vidéo", done: false };
    if (mine.length === 0) return { label: "programmer", done: false };
    if (mine.some((x) => x.status !== "published")) return { label: "à publier", done: false };
    return { label: "publié", done: true };
  }

  async function loadPoemExtras(poemId: string) {
    const { data: a } = await supabase.from("assets").select("id, kind, title").eq("poem_id", poemId);
    setPAssets(a ?? []);
    const { data: j } = await supabase.from("render_jobs").select("*").eq("poem_id", poemId).order("created_at", { ascending: false }).limit(5);
    setJobs(j ?? []);
    const firstAudio = (a ?? []).find((x) => x.kind === "audio");
    const firstImage = (a ?? []).find((x) => x.kind === "image");
    setGen({ audio_asset_id: firstAudio?.id ?? "", image_asset_id: firstImage?.id ?? "", style: "musee" });
  }

  // Vrai si la fiche ouverte a des modifications non enregistrées.
  function dirty() {
    const orig = poems.find((p) => p.id === open);
    if (!orig) return false;
    return ["title", "author", "source", "body", "status", "notes"].some((k) => (draft[k] ?? "") !== (orig[k] ?? ""));
  }

  async function openPoem(p: any) {
    if (open === p.id) { setOpen(null); return; }
    if (open && dirty() && !confirm("Modifications non enregistrées sur la fiche ouverte. Les abandonner ?")) return;
    setOpen(p.id); setDraft(p);
    loadPoemExtras(p.id);
  }

  async function save(id: string) {
    const { error } = await supabase.from("poems").update({ title: draft.title, author: draft.author, source: draft.source, body: draft.body, status: draft.status, notes: draft.notes }).eq("id", id);
    if (error) { setErr(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 1500);
    setOpen(null); load();
  }

  async function create(e: any) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("poems").insert({ title: newPoem.title, author: newPoem.author, body: newPoem.body ?? "", created_by: user?.id });
    if (error) { setErr(error.message); return; }
    setCreating(false); setNewPoem({}); load();
  }

  async function launchRender(p: any) {
    if (!gen.audio_asset_id) { alert("Ajoute d'abord une bande son (lecture) liée à ce poème dans la Bibliothèque."); return; }
    if (!p.body?.trim()) { alert("Colle d'abord le texte du poème dans la fiche : il sert à générer les sous-titres."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("render_jobs").insert({
      poem_id: p.id, audio_asset_id: gen.audio_asset_id,
      image_asset_id: gen.image_asset_id || null, style: gen.style, created_by: user?.id,
    });
    if (error) alert(error.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); loadPoemExtras(p.id); }
  }

  const audios = pAssets.filter((a) => a.kind === "audio");
  const images = pAssets.filter((a) => a.kind === "image");

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="font-serif2 text-3xl">Poèmes</h1>
        {saved && <span className="text-xs" style={{ color: "var(--gold)" }}>enregistré ✓</span>}
        <button className="btn ml-auto" onClick={() => { setCreating(!creating); setNewPoem({}); }}>+ Ajouter</button>
      </div>

      {err && <div className="card mb-6" style={{ borderColor: "#d65454", color: "#d65454" }}>Erreur : {err}</div>}

      {creating && (
        <form onSubmit={create} className="card mb-6 grid gap-3">
          <input required placeholder="Titre" value={newPoem.title ?? ""} onChange={(e) => setNewPoem({ ...newPoem, title: e.target.value })} />
          <input required placeholder="Auteur" value={newPoem.author ?? ""} onChange={(e) => setNewPoem({ ...newPoem, author: e.target.value })} />
          <textarea rows={6} placeholder="Texte du poème (édition de référence) — un vers par ligne" value={newPoem.body ?? ""} onChange={(e) => setNewPoem({ ...newPoem, body: e.target.value })} />
          <button className="btn">Créer</button>
        </form>
      )}

      <div className="grid gap-3">
        {poems.map((p) => {
          const step = nextStep(p);
          return (
            <div key={p.id} className="card">
              <button type="button" onClick={() => openPoem(p)} aria-expanded={open === p.id}
                className="w-full flex items-center gap-3 text-left flex-wrap">
                <span className="font-serif2 text-xl">{p.title}</span>
                <span style={{ color: "var(--ink-dim)" }}>{p.author}</span>
                <span className="label ml-auto" style={{ color: step.done ? "var(--ink-dim)" : "var(--gold)" }}>
                  {step.label}
                </span>
              </button>
              {open === p.id && (
                <div className="grid gap-3 mt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                    <input value={draft.author ?? ""} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
                    <input placeholder="Source (recueil, année)" value={draft.source ?? ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
                    <select value={draft.status ?? "idea"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                      {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <textarea rows={8} placeholder="Texte du poème — un vers par ligne (sert aux sous-titres)" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                  <textarea rows={2} placeholder="Notes (tableau choisi, DA, remarques…)" value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                  <div className="flex gap-3">
                    <button className="btn" onClick={() => save(p.id)}>Enregistrer</button>
                    <button className="btn2" onClick={() => setOpen(null)}>Fermer</button>
                  </div>

                  <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--line)" }}>
                    <div className="label mb-3">Générer une vidéo</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Voix (lecture)</div>
                        <select value={gen.audio_asset_id} onChange={(e) => setGen({ ...gen, audio_asset_id: e.target.value })}>
                          <option value="">— aucune —</option>
                          {audios.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                        </select></div>
                      <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Tableau (optionnel)</div>
                        <select value={gen.image_asset_id} onChange={(e) => setGen({ ...gen, image_asset_id: e.target.value })}>
                          <option value="">— fond généré —</option>
                          {images.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                        </select></div>
                      <div><div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Direction artistique</div>
                        <select value={gen.style} onChange={(e) => setGen({ ...gen, style: e.target.value })}>
                          <option value="cinetique">Cinétique (mots sur la voix)</option>
                          <option value="musee">Musée (plein écran)</option>
                          <option value="galerie">Galerie (cadre doré)</option>
                        </select></div>
                    </div>
                    <button className="btn mt-3" onClick={() => launchRender(p)}>Générer la vidéo</button>
                    <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
                      Le rendu tourne toutes les 30 min : transcription, sous-titres synchronisés sur le texte ci-dessus,
                      habillage, musique. Deux fichiers arrivent dans la Bibliothèque (avec musique / voix seule).
                      {(kindsByPoem[p.id] ?? []).includes("music")
                        ? " La bande son liée à ce poème dans la Bibliothèque sera utilisée."
                        : " Aucune bande son liée : une nappe sera générée."}
                    </p>
                    {jobs.length > 0 && (
                      <div className="mt-3 grid gap-1">
                        {jobs.map((j) => (
                          <div key={j.id} className="text-xs flex gap-3" style={{ color: j.status === "error" ? "#d65454" : "var(--ink-dim)" }}>
                            <span>{new Date(j.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            <span>{j.style}</span><span>{JOB_FR[j.status]}</span>
                            {j.error && <span>· {j.error.slice(0, 120)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {poems.length === 0 && !creating && <p style={{ color: "var(--ink-dim)" }}>Aucun poème pour l'instant — ajoute le premier.</p>}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase, bucketFor } from "@/lib/supabase";
import { AMBIANCES, LIBELLE_AMBIANCE, ambiancesDe, metaAvecAmbiances } from "@/lib/ambiances";

// Ressources = une base de données, pas un classeur.
// Le type et le poème lié sont des propriétés éditables en place : avant, se tromper de type
// à l'upload obligeait à supprimer et redéposer. Le dépôt ne demande plus de tout choisir
// à l'avance — on dépose, puis on classe (les non classés remontent en tête).
//
// `poem_id` est nullable en base et aucune contrainte ne l'exige : l'obligation n'existait
// que dans ce composant. C'est ce qui permet au vivier partagé (ressources non liées à un
// poème) d'exister sans migration.

const KINDS = ["broll", "image", "music", "audio", "video"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<string, string> = {
  video: "vidéo montée", audio: "voix", music: "bande son",
  broll: "métrage", image: "image",
};

// Le rendu ne consomme que ces types-là liés à un poème ; les autres peuvent vivre
// dans le vivier commun.
const VIVIER: string[] = ["broll", "image", "music"];

const PLAFOND_OCTETS = 1_000_000_000; // 1 Go, plan Supabase Free — rien ne purge.

const mo = (n?: number | null) => (n ? (n / 1e6).toFixed(1) + " Mo" : "—");
const jour = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });

type Tri = { col: "title" | "kind" | "amb" | "poem" | "size_bytes" | "created_at"; sens: 1 | -1 };

export default function Ressources() {
  const [assets, setAssets] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filtres, setFiltres] = useState<Set<string>>(new Set());
  const [filtrePoeme, setFiltrePoeme] = useState("");
  const [filtreAmb, setFiltreAmb] = useState<Set<string>>(new Set());
  const [tri, setTri] = useState<Tri>({ col: "created_at", sens: -1 });
  const [edit, setEdit] = useState<{ id: string; champ: "kind" | "poem" | "amb" } | null>(null);
  const [queue, setQueue] = useState<{ name: string; state: string; msg?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [nouveaux, setNouveaux] = useState<Set<string>>(new Set());

  async function load() {
    const { data, error } = await supabase.from("assets")
      .select("*, poems(id, title)").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setAssets(data ?? []);
    const { data: p } = await supabase.from("poems").select("id, title").order("created_at", { ascending: false });
    setPoems(p ?? []);
  }
  useEffect(() => { load(); }, []);

  // Le type se déduit du fichier. Une vidéo est un métrage par défaut : c'est le cas le plus
  // fréquent, et le reclassement est maintenant à un clic.
  function kindFor(f: File): Kind {
    if (f.type.startsWith("video/")) return "broll";
    if (f.type.startsWith("image/")) return "image";
    if (f.type.startsWith("audio/")) return "music";
    return "image";
  }

  async function uploadAll(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setQueue(files.map((f) => ({ name: f.name, state: "attente" })));
    const crees: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueue((qq) => qq.map((x, j) => (j === i ? { ...x, state: "envoi" } : x)));
      const k = kindFor(file);
      const bucket = k === "music" || k === "audio" ? "audios" : bucketFor(file.type);
      const path = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) {
        setQueue((qq) => qq.map((x, j) => (j === i ? { ...x, state: "erreur", msg: error.message } : x)));
        continue;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error: e2 } = await supabase.from("assets").insert({
        poem_id: null, kind: k, title: file.name, storage_bucket: bucket, storage_path: path,
        mime_type: file.type, size_bytes: file.size, created_by: user?.id,
      }).select("id").single();
      if (ins) crees.push(ins.id);
      setQueue((qq) => qq.map((x, j) => (j === i ? { ...x, state: e2 ? "erreur" : "ok", msg: e2?.message } : x)));
    }
    setBusy(false);
    setNouveaux(new Set(crees));
    load();
    setTimeout(() => setQueue([]), 4000);
  }

  // Reclasser ne déplace pas le fichier : `storage_bucket` est mémorisé par ligne, seul
  // le dépôt initial choisit un bucket.
  async function patch(id: string, champs: Record<string, any>) {
    const { error } = await supabase.from("assets").update(champs).eq("id", id);
    if (error) { setErr(error.message); return; }
    setEdit(null);
    load();
  }

  async function download(a: any) {
    const { data } = await supabase.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(a: any) {
    await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
    await supabase.from("assets").delete().eq("id", a.id);
    setConfirmId(null);
    load();
  }

  function bascule(k: string) {
    const s = new Set(filtres);
    s.has(k) ? s.delete(k) : s.add(k);
    setFiltres(s);
  }

  function basculeAmbFiltre(a: string) {
    const s = new Set(filtreAmb);
    s.has(a) ? s.delete(a) : s.add(a);
    setFiltreAmb(s);
  }

  // Cocher/décocher une ambiance sur une ressource. Écrit dans `meta` en préservant le reste
  // du jsonb. Ne referme pas l'éditeur — on en coche souvent deux ou trois d'affilée.
  async function basculeAmbiance(a: any, amb: string) {
    const actuelles = ambiancesDe(a);
    const suivantes = actuelles.includes(amb)
      ? actuelles.filter((x) => x !== amb)
      : [...actuelles, amb];
    const meta = metaAvecAmbiances(a.meta, suivantes);
    setAssets((L) => L.map((x) => (x.id === a.id ? { ...x, meta } : x)));  // retour immédiat
    const { error } = await supabase.from("assets").update({ meta }).eq("id", a.id);
    if (error) { setErr(error.message); load(); }
  }

  function trier(col: Tri["col"]) {
    setTri((t) => (t.col === col ? { col, sens: (t.sens * -1) as 1 | -1 } : { col, sens: 1 }));
  }

  const lignes = useMemo(() => {
    let L = assets;
    if (q.trim()) {
      const t = q.toLowerCase();
      L = L.filter((a) => (a.title ?? "").toLowerCase().includes(t) || (a.poems?.title ?? "").toLowerCase().includes(t));
    }
    if (filtres.size) L = L.filter((a) => filtres.has(a.kind));
    // Filtre par ambiance : cumulatif en OU — on cherche « quelque chose de sombre OU d'âpre »,
    // pas une ressource qui serait les deux à la fois.
    if (filtreAmb.size) L = L.filter((a) => ambiancesDe(a).some((x) => filtreAmb.has(x)));
    if (filtrePoeme === "__vivier") L = L.filter((a) => !a.poem_id);
    else if (filtrePoeme) L = L.filter((a) => a.poem_id === filtrePoeme);
    const v = (a: any) =>
      tri.col === "poem" ? (a.poems?.title ?? "") :
      tri.col === "kind" ? KIND_LABEL[a.kind] ?? a.kind :
      tri.col === "amb" ? ambiancesDe(a).join(",") :
      tri.col === "size_bytes" ? (a.size_bytes ?? 0) : (a[tri.col] ?? "");
    return [...L].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === y) return 0;
      return (x > y ? 1 : -1) * tri.sens;
    });
  }, [assets, q, filtres, filtreAmb, filtrePoeme, tri]);

  const total = assets.reduce((s, a) => s + (a.size_bytes ?? 0), 0);
  const aClasser = assets.filter((a) => !a.poem_id && !VIVIER.includes(a.kind)).length;
  const sansAmbiance = assets.filter((a) => VIVIER.includes(a.kind) && ambiancesDe(a).length === 0).length;
  const COLS = "minmax(170px,2fr) 118px minmax(150px,1.6fr) minmax(110px,1fr) 84px 92px 88px";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); uploadAll(Array.from(e.dataTransfer.files)); }}
    >
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="font-serif2 text-3xl">Ressources</h1>
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {assets.length} fichier{assets.length > 1 ? "s" : ""} · {mo(total)} sur 1 Go
        </span>
      </div>
      <p className="mb-5 text-sm" style={{ color: "var(--ink-dim)" }}>
        Dépose, puis classe. La voix d&apos;un poème se dépose sur sa fiche, dans l&apos;Atelier.
      </p>

      {err && <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Erreur : {err}</div>}

      {/* barre d'outils */}
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          style={{ width: 200 }} />
        {KINDS.map((k) => {
          const on = filtres.has(k);
          return (
            <button key={k} onClick={() => bascule(k)} aria-pressed={on}
              className="text-xs rounded-full px-3 py-1"
              style={{
                border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                color: on ? "var(--gold)" : "var(--ink-dim)",
                background: on ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "transparent",
              }}>
              {KIND_LABEL[k]}
            </button>
          );
        })}
        <select value={filtrePoeme} onChange={(e) => setFiltrePoeme(e.target.value)} style={{ width: 190 }}>
          <option value="">Tous les poèmes</option>
          <option value="__vivier">Vivier commun (sans poème)</option>
          {poems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <label className="btn text-xs cursor-pointer ml-auto">
          {busy ? "envoi…" : "+ Déposer"}
          <input type="file" multiple disabled={busy} style={{ display: "none" }}
            onChange={(e) => { uploadAll(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }} />
        </label>
      </div>

      {/* filtre par ambiance — le vocabulaire est fermé (lib/ambiances.ts) */}
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <span className="label" style={{ marginRight: 4 }}>Ambiance</span>
        {AMBIANCES.map((a) => {
          const on = filtreAmb.has(a.id);
          return (
            <button key={a.id} onClick={() => basculeAmbFiltre(a.id)} aria-pressed={on} title={a.aide}
              className="text-xs rounded-full px-3 py-1"
              style={{
                border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                color: on ? "var(--gold)" : "var(--ink-dim)",
                background: on ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "transparent",
              }}>
              {a.label}
            </button>
          );
        })}
        {filtreAmb.size > 0 && (
          <button className="text-xs" style={{ color: "var(--ink-dim)" }} onClick={() => setFiltreAmb(new Set())}>
            tout
          </button>
        )}
      </div>

      {(aClasser > 0 || sansAmbiance > 0) && (
        <p className="text-xs mb-3" style={{ color: "var(--gold)" }}>
          {aClasser > 0 && <>{aClasser} ressource{aClasser > 1 ? "s" : ""} que le rendu ne verra pas tant qu&apos;un poème ne leur est pas lié. </>}
          {sansAmbiance > 0 && <>{sansAmbiance} ressource{sansAmbiance > 1 ? "s" : ""} du vivier sans ambiance — invisible{sansAmbiance > 1 ? "s" : ""} aux filtres.</>}
        </p>
      )}

      {queue.length > 0 && (
        <div className="card mb-3 grid gap-1">
          {queue.map((it, i) => (
            <div key={i} className="flex gap-3 text-xs items-center">
              <span style={{ width: 74, flexShrink: 0, color: it.state === "ok" ? "var(--gold)" : it.state === "erreur" ? "var(--danger)" : "var(--ink-dim)" }}>
                {it.state === "ok" ? "envoyé ✓" : it.state === "erreur" ? "erreur" : it.state === "envoi" ? "envoi…" : "en attente"}
              </span>
              <span>{it.name}</span>
              {it.msg && <span style={{ color: "var(--danger)" }}>· {it.msg}</span>}
            </div>
          ))}
        </div>
      )}

      {/* table */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--panel)" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div className="grid text-xs" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              {([["title", "Nom"], ["kind", "Type"], ["amb", "Ambiances"], ["poem", "Poème"], ["size_bytes", "Taille"], ["created_at", "Ajouté"]] as const).map(([c, l]) => (
                <button key={c} onClick={() => trier(c)} className="text-left px-3 py-2"
                  style={{ color: tri.col === c ? "var(--ink)" : "var(--ink-dim)", cursor: "pointer" }}>
                  {l}{tri.col === c ? (tri.sens === 1 ? " ↑" : " ↓") : ""}
                </button>
              ))}
              <div />
            </div>

            {lignes.map((a) => (
              <div key={a.id} className="grid items-center text-sm"
                style={{
                  gridTemplateColumns: COLS, borderBottom: "1px solid var(--line)",
                  background: nouveaux.has(a.id) ? "color-mix(in srgb, var(--gold) 7%, transparent)" : "transparent",
                }}>
                <div className="px-3 py-2 truncate" title={a.title}>{a.title}</div>

                <div className="px-3 py-2">
                  {edit?.id === a.id && edit.champ === "kind" ? (
                    <select autoFocus defaultValue={a.kind} onBlur={() => setEdit(null)}
                      onChange={(e) => patch(a.id, { kind: e.target.value })}>
                      {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEdit({ id: a.id, champ: "kind" })}
                      className="text-xs rounded-full px-2 py-0.5"
                      style={{ border: "1px solid var(--line)", color: "var(--ink-dim)" }}>
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2">
                  {edit?.id === a.id && edit.champ === "amb" ? (
                    <div className="flex gap-1 flex-wrap items-center">
                      {AMBIANCES.map((amb) => {
                        const on = ambiancesDe(a).includes(amb.id);
                        return (
                          <button key={amb.id} title={amb.aide} onClick={() => basculeAmbiance(a, amb.id)}
                            className="text-xs rounded-full px-2 py-0.5"
                            style={{
                              border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                              color: on ? "var(--gold)" : "var(--ink-dim)",
                              background: on ? "color-mix(in srgb, var(--gold) 12%, transparent)" : "transparent",
                            }}>
                            {amb.label}
                          </button>
                        );
                      })}
                      <button className="text-xs ml-1" style={{ color: "var(--ink-dim)" }} onClick={() => setEdit(null)}>ok</button>
                    </div>
                  ) : (
                    <button onClick={() => setEdit({ id: a.id, champ: "amb" })} className="text-xs text-left w-full">
                      {ambiancesDe(a).length === 0
                        ? <span style={{ color: "var(--ink-dim)" }}>+ ambiance</span>
                        : <span className="flex gap-1 flex-wrap">
                            {ambiancesDe(a).map((x) => (
                              <span key={x} className="rounded-full px-2 py-0.5"
                                style={{ border: "1px solid var(--line)", color: "var(--gold)" }}>
                                {LIBELLE_AMBIANCE[x] ?? x}
                              </span>
                            ))}
                          </span>}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2 truncate">
                  {edit?.id === a.id && edit.champ === "poem" ? (
                    <select autoFocus defaultValue={a.poem_id ?? ""} onBlur={() => setEdit(null)}
                      onChange={(e) => patch(a.id, { poem_id: e.target.value || null })}>
                      <option value="">— vivier commun —</option>
                      {poems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEdit({ id: a.id, champ: "poem" })} className="text-xs text-left truncate w-full"
                      style={{ color: a.poems?.title ? "var(--gold)" : "var(--ink-dim)" }}>
                      {a.poems?.title ?? "vivier commun"}
                    </button>
                  )}
                </div>

                <div className="px-3 py-2 text-xs" style={{ color: "var(--ink-dim)" }}>{mo(a.size_bytes)}</div>
                <div className="px-3 py-2 text-xs" style={{ color: "var(--ink-dim)" }}>{jour(a.created_at)}</div>

                <div className="px-3 py-2 flex gap-1 justify-end">
                  <button className="text-xs" style={{ color: "var(--ink-dim)" }} onClick={() => download(a)} title="télécharger">↓</button>
                  {confirmId === a.id
                    ? <button className="text-xs" style={{ color: "var(--danger)" }} onClick={() => remove(a)}>confirmer ?</button>
                    : <button className="text-xs" style={{ color: "var(--ink-dim)" }} onClick={() => setConfirmId(a.id)} title="supprimer">✕</button>}
                </div>
              </div>
            ))}

            {lignes.length === 0 && (
              <div className="px-3 py-8 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
                {assets.length === 0 ? "Rien pour l'instant — dépose tes tableaux, métrages et bandes son." : "Aucune ressource ne correspond aux filtres."}
              </div>
            )}
          </div>
        </div>
      </div>

      {over && (
        <div className="mt-3 rounded-xl text-center font-serif2 text-xl"
          style={{ border: "1px dashed var(--gold)", padding: "24px", color: "var(--gold)" }}>
          Lâche pour déposer
        </div>
      )}
    </div>
  );
}

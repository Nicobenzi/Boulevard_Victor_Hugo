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
  // Le filtre « poème » n'est plus un menu déroulant : chercher un titre suffit depuis que la
  // recherche couvre les poèmes. Restent deux états qui ne se tapent pas — le vivier commun et
  // ce qui reste à classer — devenus des pastilles comme les autres.
  const [vivierSeul, setVivierSeul] = useState(false);
  const [aClasserSeul, setAClasserSeul] = useState(false);
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

  // ⚠ Cette fonction avalait les deux erreurs : on cliquait « confirmer ? », la ligne restait,
  // et rien ne disait pourquoi. Le bouton passait pour cassé alors que c'est la base qui
  // refusait — `render_jobs.video_asset_id` était en NO ACTION (corrigé par 20260824d).
  // Une suppression qui échoue en silence est pire qu'une suppression impossible.
  async function remove(a: any) {
    // La base d'abord : si elle refuse, le fichier est toujours là et la ressource reste
    // cohérente. Dans l'ordre inverse, un échec en base laissait une ligne pointant vers un
    // fichier effacé — un asset fantôme, impossible à télécharger et impossible à supprimer.
    const { error } = await supabase.from("assets").delete().eq("id", a.id);
    if (error) {
      setErr(
        error.code === "23503"
          ? `« ${a.title} » est encore utilisée par un rendu ou une publication. Détache-la d'abord.`
          : error.message
      );
      setConfirmId(null);
      return;
    }
    const { error: eStockage } = await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
    // La ligne est partie : on ne remet rien en cause, mais un fichier resté au stockage
    // consomme le quota sans plus apparaître nulle part. Il faut le dire.
    if (eStockage) setErr(`Ligne supprimée, mais le fichier est resté au stockage : ${eStockage.message}`);
    else setErr(null);
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

  // ————— filtrage et facettes —————
  //
  // Le 24/08, cette barre affichait **14 commandes dont 10 ne pouvaient renvoyer que du vide** :
  // aucune image en base, aucune ambiance renseignée. Elle annonçait une bibliothèque qui
  // n'existait pas encore, et pour 19 fichiers faire défiler la table allait plus vite.
  //
  // D'où le principe : **un seul champ qui cherche partout** (nom, type, ambiance, poème) et
  // des pastilles qui **n'existent que si elles ramènent quelque chose**. Rien ne se règle
  // « au cas où » : la barre grandit d'elle-même à mesure que le vivier se remplit.
  const { lignes, factKinds, factAmb, nVivier } = useMemo(() => {
    const texte = q.trim().toLowerCase();

    // La recherche couvre les libellés affichés, pas seulement les noms de fichiers : taper
    // « métrage », « braise » ou « Bacchanale » doit marcher, sinon le champ unique ment.
    const parTexte = (a: any) => {
      if (!texte) return true;
      return [
        a.title ?? "",
        a.poems?.title ?? "",
        KIND_LABEL[a.kind] ?? a.kind,
        ...ambiancesDe(a).map((x) => LIBELLE_AMBIANCE[x] ?? x),
      ].some((c) => c.toLowerCase().includes(texte));
    };
    const parVivier = (a: any) => !vivierSeul || !a.poem_id;
    const parClasser = (a: any) =>
      !aClasserSeul || (VIVIER.includes(a.kind) && ambiancesDe(a).length === 0);
    const parKind = (a: any) => !filtres.size || filtres.has(a.kind);
    // Ambiances en OU : on cherche « quelque chose de sombre OU d'âpre », pas une ressource
    // qui serait les deux à la fois.
    const parAmb = (a: any) => !filtreAmb.size || ambiancesDe(a).some((x) => filtreAmb.has(x));

    const socle = assets.filter((a) => parTexte(a) && parVivier(a) && parClasser(a));

    // ⚠ Le compte d'une facette s'évalue SANS elle-même. Sinon il affiche le résultat déjà
    // filtré et ne dit plus ce qu'on gagnerait à cliquer ailleurs — un compteur qui répète
    // la sélection ne sert à rien.
    const pourKinds = socle.filter(parAmb);
    const pourAmb = socle.filter(parKind);

    // `f.n > 0 || déjà cochée` : une pastille active ne disparaît jamais sous le doigt, même
    // quand elle ne ramène plus rien — sinon on ne pourrait plus la décocher.
    const factKinds = KINDS
      .map((k) => ({ id: k as string, label: KIND_LABEL[k], n: pourKinds.filter((a) => a.kind === k).length }))
      .filter((f) => f.n > 0 || filtres.has(f.id));
    const factAmb = AMBIANCES
      .map((a) => ({ id: a.id, label: a.label, aide: a.aide,
                     n: pourAmb.filter((x) => ambiancesDe(x).includes(a.id)).length }))
      .filter((f) => f.n > 0 || filtreAmb.has(f.id));

    const L = socle.filter((a) => parKind(a) && parAmb(a));
    const v = (a: any) =>
      tri.col === "poem" ? (a.poems?.title ?? "") :
      tri.col === "kind" ? KIND_LABEL[a.kind] ?? a.kind :
      tri.col === "amb" ? ambiancesDe(a).join(",") :
      tri.col === "size_bytes" ? (a.size_bytes ?? 0) : (a[tri.col] ?? "");
    const lignes = [...L].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === y) return 0;
      return (x > y ? 1 : -1) * tri.sens;
    });
    return { lignes, factKinds, factAmb, nVivier: assets.filter((a) => !a.poem_id).length };
  }, [assets, q, filtres, filtreAmb, vivierSeul, aClasserSeul, tri]);

  // Les filtres actifs, tous types confondus, sous une forme unique : un libellé et le geste
  // qui l'enlève. C'est ce qui permet de les rassembler au même endroit.
  const jetons = [
    ...(q.trim() ? [{ cle: "q", label: `« ${q.trim()} »`, retirer: () => setQ("") }] : []),
    ...[...filtres].map((k) => ({
      cle: `k-${k}`, label: KIND_LABEL[k] ?? k,
      retirer: () => setFiltres((s) => { const n = new Set(s); n.delete(k); return n; }),
    })),
    ...[...filtreAmb].map((a) => ({
      cle: `a-${a}`, label: LIBELLE_AMBIANCE[a] ?? a,
      retirer: () => setFiltreAmb((s) => { const n = new Set(s); n.delete(a); return n; }),
    })),
    ...(vivierSeul ? [{ cle: "vivier", label: "vivier commun", retirer: () => setVivierSeul(false) }] : []),
    ...(aClasserSeul ? [{ cle: "classer", label: "à classer", retirer: () => setAClasserSeul(false) }] : []),
  ];

  function toutEffacer() {
    setQ(""); setFiltres(new Set()); setFiltreAmb(new Set());
    setVivierSeul(false); setAClasserSeul(false);
  }

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

      {/* ————— la barre ————— */}
      <div className="flex gap-2 items-center flex-wrap mb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une ressource"
          placeholder="Chercher un nom, un type, une ambiance, un poème…"
          style={{ maxWidth: 400 }} />
        <label className="btn text-xs cursor-pointer ml-auto">
          {busy ? "envoi…" : "+ Déposer"}
          <input type="file" multiple disabled={busy} style={{ display: "none" }}
            onChange={(e) => { uploadAll(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }} />
        </label>
      </div>

      {/* Les filtres actifs, rassemblés. Éparpillés dans la barre, on oubliait d'en enlever un
          et la bibliothèque paraissait vide sans qu'on sache pourquoi. */}
      {jetons.length > 0 && (
        <div className="flex gap-2 items-center flex-wrap mb-2">
          {jetons.map((j) => (
            <button key={j.cle} onClick={j.retirer} aria-label={`Retirer le filtre ${j.label}`}
              className="text-xs rounded-full px-3 py-1"
              style={{
                border: "1px solid var(--gold)", color: "var(--gold)",
                background: "color-mix(in srgb, var(--gold) 10%, transparent)",
              }}>
              {j.label} ✕
            </button>
          ))}
          <button className="text-xs" style={{ color: "var(--ink-dim)" }} onClick={toutEffacer}>
            tout effacer
          </button>
          <span className="text-xs" aria-live="polite" style={{ color: "var(--ink-dim)" }}>
            {lignes.length} sur {assets.length}
          </span>
        </div>
      )}

      {/* Les facettes. Chacune porte son compte et n'apparaît que si elle ramène quelque
          chose : une pastille qui ne peut rendre que du vide est du bruit. */}
      <div className="flex gap-2 items-center flex-wrap mb-3">
        {factKinds.map((f) => {
          const on = filtres.has(f.id);
          return (
            <button key={f.id} onClick={() => bascule(f.id)} aria-pressed={on}
              className="text-xs rounded-full px-3 py-1"
              style={{
                border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                color: on ? "var(--gold)" : "var(--ink-dim)",
                background: on ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "transparent",
              }}>
              {f.label} <span style={{ opacity: 0.7 }}>{f.n}</span>
            </button>
          );
        })}

        {factAmb.length > 0 && factKinds.length > 0 && (
          <span aria-hidden style={{ color: "var(--line)" }}>│</span>
        )}
        {factAmb.map((f) => {
          const on = filtreAmb.has(f.id);
          return (
            <button key={f.id} onClick={() => basculeAmbFiltre(f.id)} aria-pressed={on} title={f.aide}
              className="text-xs rounded-full px-3 py-1"
              style={{
                border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                color: on ? "var(--gold)" : "var(--ink-dim)",
                background: on ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "transparent",
              }}>
              {f.label} <span style={{ opacity: 0.7 }}>{f.n}</span>
            </button>
          );
        })}

        {nVivier > 0 && (
          <button onClick={() => setVivierSeul((v) => !v)} aria-pressed={vivierSeul}
            className="text-xs rounded-full px-3 py-1"
            title="Les ressources qui ne sont liées à aucun poème — le vivier partagé"
            style={{
              border: `1px solid ${vivierSeul ? "var(--gold)" : "var(--line)"}`,
              color: vivierSeul ? "var(--gold)" : "var(--ink-dim)",
              background: vivierSeul ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "transparent",
            }}>
            vivier commun <span style={{ opacity: 0.7 }}>{nVivier}</span>
          </button>
        )}
      </div>

      {/* Une invitation à agir, pas un constat. L'ancienne formulation — « invisibles aux
          filtres » — décrivait un problème sans donner le geste qui le règle. */}
      {(aClasser > 0 || sansAmbiance > 0) && (
        <div className="flex gap-3 items-baseline flex-wrap mb-3 text-xs">
          {sansAmbiance > 0 && (
            <button onClick={() => setAClasserSeul((v) => !v)} aria-pressed={aClasserSeul}
              style={{ color: "var(--gold)", textDecoration: "underline" }}>
              → {sansAmbiance} ressource{sansAmbiance > 1 ? "s" : ""} à classer par ambiance
            </button>
          )}
          {aClasser > 0 && (
            <span style={{ color: "var(--ink-dim)" }}>
              {aClasser} sans poème lié — le rendu ne {aClasser > 1 ? "les" : "la"} verra pas.
            </span>
          )}
        </div>
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
                // Le tri reste dans les en-têtes : c'est là qu'on le cherche, et une commande
                // de tri séparée aurait rajouté au fouillis qu'on vient d'enlever.
                <button key={c} onClick={() => trier(c)} className="text-left px-3 py-2"
                  aria-label={`Trier par ${l}${tri.col === c ? (tri.sens === 1 ? ", croissant" : ", décroissant") : ""}`}
                  style={{ color: tri.col === c ? "var(--ink)" : "var(--ink-dim)", cursor: "pointer" }}>
                  {l}<span aria-hidden>{tri.col === c ? (tri.sens === 1 ? " ↑" : " ↓") : ""}</span>
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

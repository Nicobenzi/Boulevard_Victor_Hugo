"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AMBIANCES, LIBELLE_AMBIANCE, ambiancesDe, metaAvecAmbiances } from "@/lib/ambiances";
import {
  besoinApercu, dureeDe, fabriquerApercu, fmtDuree, metaAvecApercu, metaAvecEchec, vignetteDe,
} from "@/lib/vignette";

// Le vivier — spec-vivier-visible-2026-08-24, lot 1.
//
// Un seul composant pour deux endroits : la page Ressources (`mode="gestion"`) et le panneau de
// l'Atelier (`mode="selection"`, lot 3). Le défaut qu'on corrige est que la matière n'était
// jamais visible : on cochait « braise » sur un nom de fichier. Résultat mesuré au 24/08 :
// 22 ressources en base, ZÉRO ambiance renseignée. Le vocabulaire du 23/08 n'avait jamais servi.
//
// Ce qui est repris au caractère près de l'ancienne page : le champ unique qui cherche partout,
// les facettes auto-masquées, le compte d'une facette évalué SANS elle-même, la facette active
// qui ne disparaît jamais, les jetons rassemblés. C'est du travail déjà payé.
//
// Ce qui change : la table à 7 colonnes devient une liste vignettée, et les trois éditeurs
// sortent de la ligne pour aller dans une fiche. Une pastille de 20 px dans une ligne de 34
// n'est pas une bonne cible, mieux la signaler n'y aurait rien changé.

export const KINDS = ["broll", "image", "music", "audio", "video"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<string, string> = {
  video: "vidéo montée", audio: "voix", music: "bande son",
  broll: "métrage", image: "image",
};

// Les types qui peuvent vivre sans poème lié. Le rendu ne consomme que ceux-là.
export const VIVIER: string[] = ["broll", "image", "music"];

const EST_SON = (k: string) => k === "music" || k === "audio";

// Les colonnes sont nommées : `meta` porte les vignettes (~8 Ko la ligne), on ne veut pas
// qu'un `select *` les traîne dans des écrans qui n'en ont pas besoin.
const COLONNES =
  "id, title, kind, poem_id, size_bytes, created_at, storage_bucket, storage_path, mime_type, meta, poems(id, title)";

const mo = (n?: number | null) => (n ? (n / 1e6).toFixed(1) + " Mo" : "—");
const jour = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });

export type Tri = "recent" | "nom" | "poids";
const TRIS: { id: Tri; label: string }[] = [
  { id: "recent", label: "plus récents" },
  { id: "nom", label: "nom" },
  { id: "poids", label: "poids" },
];

export type ViverProps = {
  mode?: "gestion" | "selection";
  kinds?: string[];
  poemId?: string | null;
  valeur?: string | null;
  onChoisir?: (id: string | null) => void;
  compact?: boolean;
  /** Incrémenté par l'hôte après un dépôt : la liste se recharge sans état partagé. */
  rafraichir?: number;
  /** Tri contrôlé, optionnel. Sert au quota : « pour faire de la place, trie par poids ». */
  tri?: Tri;
  onTri?: (t: Tri) => void;
};

export default function Vivier({
  mode = "gestion", kinds, poemId = null, valeur = null, onChoisir, compact = false, rafraichir = 0,
  tri: triImpose, onTri,
}: ViverProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filtres, setFiltres] = useState<Set<string>>(new Set());
  const [filtreAmb, setFiltreAmb] = useState<Set<string>>(new Set());
  const [vivierSeul, setVivierSeul] = useState(false);
  const [aClasserSeul, setAClasserSeul] = useState(false);
  const [triInterne, setTriInterne] = useState<Tri>("recent");
  const tri = triImpose ?? triInterne;
  const majTri = (t: Tri) => { setTriInterne(t); onTri?.(t); };
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [curseur, setCurseur] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [errLigne, setErrLigne] = useState<{ id: string; msg: string } | null>(null);
  const [prep, setPrep] = useState<{ fait: number; total: number } | null>(null);
  const [annonce, setAnnonce] = useState("");

  const listeRef = useRef<HTMLUListElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from("assets").select(COLONNES).order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setAssets(data ?? []);
    if (mode === "gestion") {
      const { data: p } = await supabase.from("poems").select("id, title").order("created_at", { ascending: false });
      setPoems(p ?? []);
    }
  }, [mode]);

  // `rafraichir` est lu pour lui-même : l'hôte l'incrémente après un dépôt, c'est le signal de
  // rechargement. Sans le `void`, la règle des dépendances le déclare inutile et le retire.
  useEffect(() => { void rafraichir; charger(); }, [charger, rafraichir]);

  // ————— filtrage et facettes : le useMemo de l'ancienne page, déplacé, pas réécrit —————
  const { lignes, factKinds, factAmb, nVivier } = useMemo(() => {
    const texte = q.trim().toLowerCase();

    const parTexte = (a: any) => {
      if (!texte) return true;
      return [
        a.title ?? "",
        a.poems?.title ?? "",
        KIND_LABEL[a.kind] ?? a.kind,
        ...ambiancesDe(a).map((x) => LIBELLE_AMBIANCE[x] ?? x),
      ].some((c) => c.toLowerCase().includes(texte));
    };
    const parPerimetre = (a: any) => !kinds || kinds.includes(a.kind);
    const parVivier = (a: any) => !vivierSeul || !a.poem_id;
    const parClasser = (a: any) =>
      !aClasserSeul || (VIVIER.includes(a.kind) && ambiancesDe(a).length === 0);
    const parKind = (a: any) => !filtres.size || filtres.has(a.kind);
    // Ambiances en OU : on cherche « quelque chose de sombre OU d'âpre ».
    const parAmb = (a: any) => !filtreAmb.size || ambiancesDe(a).some((x) => filtreAmb.has(x));

    const socle = assets.filter((a) => parPerimetre(a) && parTexte(a) && parVivier(a) && parClasser(a));

    // ⚠ Le compte d'une facette s'évalue SANS elle-même, sinon il répète la sélection au lieu
    // de dire ce qu'on gagnerait à cliquer ailleurs.
    const pourKinds = socle.filter(parAmb);
    const pourAmb = socle.filter(parKind);

    // `n > 0 || déjà cochée` : une facette active ne disparaît jamais sous le doigt.
    const factKinds = KINDS
      .map((k) => ({ id: k as string, label: KIND_LABEL[k], n: pourKinds.filter((a) => a.kind === k).length }))
      .filter((f) => f.n > 0 || filtres.has(f.id));
    const factAmb = AMBIANCES
      .map((a) => ({ id: a.id as string, label: a.label as string, aide: a.aide as string,
                     n: pourAmb.filter((x) => ambiancesDe(x).includes(a.id)).length }))
      .filter((f) => f.n > 0 || filtreAmb.has(f.id));

    const L = socle.filter((a) => parKind(a) && parAmb(a));
    const rang = (a: any) =>
      tri === "nom" ? (a.title ?? "").toLowerCase() :
      tri === "poids" ? -(a.size_bytes ?? 0) : -new Date(a.created_at).getTime();
    const lignes = [...L].sort((a, b) => {
      // Le poème courant remonte en tête : au montage, ses propres plans passent avant le reste.
      if (poemId) {
        const pa = a.poem_id === poemId ? 0 : 1;
        const pb = b.poem_id === poemId ? 0 : 1;
        if (pa !== pb) return pa - pb;
      }
      const x = rang(a), y = rang(b);
      return x === y ? 0 : x > y ? 1 : -1;
    });

    return {
      lignes, factKinds, factAmb,
      nVivier: assets.filter((a) => parPerimetre(a) && !a.poem_id).length,
    };
  }, [assets, q, filtres, filtreAmb, vivierSeul, aClasserSeul, tri, kinds, poemId]);

  useEffect(() => { setCurseur((c) => Math.min(c, Math.max(0, lignes.length - 1))); }, [lignes.length]);

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

  // Le vide filtré doit dire QUEL filtre le cause. Le compte sans la facette existe déjà.
  const sansTypeIlYAurait = useMemo(() => {
    if (lignes.length || !filtres.size) return 0;
    return assets.filter((a) => (!kinds || kinds.includes(a.kind))
      && (!filtreAmb.size || ambiancesDe(a).some((x) => filtreAmb.has(x)))
      && (!q.trim() || [a.title ?? "", a.poems?.title ?? ""].some((c) => c.toLowerCase().includes(q.trim().toLowerCase())))
    ).length;
  }, [lignes.length, filtres, filtreAmb, q, assets, kinds]);

  // ————— écritures —————

  async function patch(id: string, champs: Record<string, any>, optimiste?: (a: any) => any) {
    if (optimiste) setAssets((L) => L.map((x) => (x.id === id ? optimiste(x) : x)));
    const { error } = await supabase.from("assets").update(champs).eq("id", id);
    // Une erreur avalée produit un bouton qui a l'air cassé. Elle s'affiche DANS la ligne.
    if (error) { setErrLigne({ id, msg: error.message }); charger(); return false; }
    setErrLigne(null);
    if (!optimiste) charger();
    return true;
  }

  async function basculeAmbiance(a: any, amb: string) {
    const actuelles = ambiancesDe(a);
    const suivantes = actuelles.includes(amb) ? actuelles.filter((x) => x !== amb) : [...actuelles, amb];
    const meta = metaAvecAmbiances(a.meta, suivantes);
    setAnnonce(`${LIBELLE_AMBIANCE[amb] ?? amb}, ${suivantes.includes(amb) ? "coché" : "décoché"}`);
    await patch(a.id, { meta }, (x) => ({ ...x, meta }));
  }

  async function urlSignee(a: any) {
    const { data } = await supabase.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
    return data?.signedUrl ?? null;
  }

  async function ouvrirOriginal(a: any) {
    const u = await urlSignee(a);
    if (u) window.open(u, "_blank");
  }

  // Base d'abord, stockage ensuite : dans l'ordre inverse, un échec en base laisse une ligne
  // pointant vers un fichier effacé — un asset fantôme. Comportement conservé du 24/08.
  async function supprimer(a: any) {
    const { error } = await supabase.from("assets").delete().eq("id", a.id);
    if (error) {
      setErrLigne({
        id: a.id,
        msg: error.code === "23503"
          ? `« ${a.title} » est encore utilisée par un rendu ou une publication. Détache-la d'abord.`
          : error.message,
      });
      dialogRef.current?.close();
      return;
    }
    const { error: eStockage } = await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
    if (eStockage) setErr(`Ligne supprimée, mais le fichier est resté au stockage : ${eStockage.message}`);
    dialogRef.current?.close();
    setOuverte(null);
    charger();
  }

  // ————— rattrapage des aperçus —————
  //
  // Les ressources déjà en base n'ont pas de vignette. On ne la fabrique PAS à l'affichage :
  // ce serait 22 téléchargements et 22 écritures déclenchés par un simple coup d'œil, à deux
  // sur la même page. Le geste est explicite, il ne se répète jamais.
  const aPreparer = useMemo(() => assets.filter(besoinApercu), [assets]);

  async function preparerApercus() {
    const file = aPreparer.slice();
    setPrep({ fait: 0, total: file.length });
    for (let i = 0; i < file.length; i++) {
      const a = file[i];
      try {
        const { data, error } = await supabase.storage.from(a.storage_bucket).download(a.storage_path);
        if (error || !data) throw error ?? new Error("téléchargement impossible");
        const apercu = await fabriquerApercu(data, a.kind);
        const meta = metaAvecApercu(a.meta, apercu);
        await supabase.from("assets").update({ meta }).eq("id", a.id);
        setAssets((L) => L.map((x) => (x.id === a.id ? { ...x, meta } : x)));
      } catch {
        // Un échec se mémorise, sinon on retente à chaque passage et le compteur ne descend pas.
        const meta = metaAvecEchec(a.meta);
        await supabase.from("assets").update({ meta }).eq("id", a.id);
        setAssets((L) => L.map((x) => (x.id === a.id ? { ...x, meta } : x)));
      }
      setPrep({ fait: i + 1, total: file.length });
    }
    setPrep(null);
  }

  // ————— lecture d'un son : un seul à la fois —————
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [joue, setJoue] = useState<string | null>(null);

  async function basculeLecture(a: any) {
    const el = audioRef.current;
    if (!el) return;
    if (joue === a.id) { el.pause(); setJoue(null); return; }
    const u = await urlSignee(a);
    if (!u) { setErrLigne({ id: a.id, msg: "le fichier n'a pas pu être ouvert." }); return; }
    el.src = u;
    try { await el.play(); setJoue(a.id); } catch { setJoue(null); }
  }

  // ————— clavier : la liste est UN arrêt de tabulation —————
  //
  // Classer une salve ne doit jamais demander de traverser 24 lignes au Tab.
  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCurseur((c) => Math.min(c + 1, lignes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCurseur((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const a = lignes[curseur];
      if (a) mode === "selection" ? onChoisir?.(valeur === a.id ? null : a.id) : setOuverte(a.id);
    } else if (e.key === "Escape" && ouverte) { setOuverte(null); listeRef.current?.focus(); }
  }

  const active = assets.find((a) => a.id === ouverte) ?? null;
  const iActive = lignes.findIndex((a) => a.id === ouverte);

  return (
    <div className={compact ? "" : "grid gap-4"} style={compact ? undefined : { gridTemplateColumns: ouverte ? "minmax(0,1fr) 320px" : "minmax(0,1fr)" }}>
      <div style={{ minWidth: 0 }}>
        {err && (
          <div className="card mb-3" role="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
            {err}
          </div>
        )}

        {/* ————— la barre ————— */}
        <div className="flex gap-2 items-center flex-wrap mb-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une ressource"
            placeholder={compact ? "chercher, ou une ambiance…" : "Chercher un nom, un type, une ambiance, un poème…"}
            style={{ maxWidth: compact ? undefined : 400 }} />
          {!compact && (
            <div className="flex gap-1 items-center" role="group" aria-label="Trier">
              <span className="text-xs" style={{ color: "var(--ink-dim)" }}>Trier :</span>
              {TRIS.map((t) => (
                <button key={t.id} className="facette" aria-pressed={tri === t.id}
                  onClick={() => { majTri(t.id); setAnnonce(`${lignes.length} ressources, triées par ${t.label}`); }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {jetons.length > 0 && (
          <div className="flex gap-2 items-center flex-wrap mb-2">
            {jetons.map((j) => (
              <button key={j.cle} onClick={j.retirer} className="chip actif"
                aria-label={`Retirer le filtre ${j.label}`}>
                {j.label} <span aria-hidden>✕</span>
              </button>
            ))}
            <button className="facette" onClick={toutEffacer}>tout effacer</button>
            <span className="text-xs" aria-live="polite" style={{ color: "var(--ink-dim)" }}>
              {lignes.length} sur {assets.length}
            </span>
          </div>
        )}

        {/* Les facettes : du texte discret, pas des contrôles. Elles n'ont pas la même forme
            que les jetons ci-dessus, qui eux se retirent. */}
        <div className="flex gap-1 items-center flex-wrap mb-3">
          {factKinds.map((f) => (
            <button key={f.id} className="facette" aria-pressed={filtres.has(f.id)}
              onClick={() => setFiltres((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}>
              {f.label} <span className="n">{f.n}</span>
            </button>
          ))}
          {factAmb.length > 0 && factKinds.length > 0 && <span aria-hidden style={{ color: "var(--line)" }}>│</span>}
          {factAmb.map((f) => (
            <button key={f.id} className="facette" title={f.aide} aria-pressed={filtreAmb.has(f.id)}
              onClick={() => setFiltreAmb((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}>
              {f.label} <span className="n">{f.n}</span>
            </button>
          ))}
          {nVivier > 0 && !compact && (
            <button className="facette" aria-pressed={vivierSeul} onClick={() => setVivierSeul((v) => !v)}
              title="Les ressources qui ne sont liées à aucun poème — le vivier partagé">
              vivier commun <span className="n">{nVivier}</span>
            </button>
          )}
        </div>

        {/* Un constat porte son geste. */}
        {mode === "gestion" && (aPreparer.length > 0 || assets.some((a) => VIVIER.includes(a.kind) && ambiancesDe(a).length === 0)) && (
          <div className="flex gap-3 items-center flex-wrap mb-3 text-xs">
            {aPreparer.length > 0 && (
              <button className="btn2 text-xs" disabled={!!prep} onClick={preparerApercus}>
                {prep ? `préparation… ${prep.fait} sur ${prep.total}` : `préparer les aperçus (${aPreparer.length})`}
              </button>
            )}
            {assets.some((a) => VIVIER.includes(a.kind) && ambiancesDe(a).length === 0) && (
              <button className="facette" aria-pressed={aClasserSeul} onClick={() => setAClasserSeul((v) => !v)}
                style={{ color: "var(--encre)" }}>
                → {assets.filter((a) => VIVIER.includes(a.kind) && ambiancesDe(a).length === 0).length} à classer par ambiance
              </button>
            )}
          </div>
        )}

        {/* ————— la liste ————— */}
        <ul ref={listeRef} tabIndex={0} onKeyDown={auClavier}
          aria-label="Ressources" aria-activedescendant={lignes[curseur] ? `res-${lignes[curseur].id}` : undefined}
          style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)", listStyle: "none", margin: 0, padding: 0 }}>
          {lignes.map((a, i) => {
            const vig = vignetteDe(a);
            const d = fmtDuree(dureeDe(a));
            const choisi = mode === "selection" && valeur === a.id;
            return (
              <li key={a.id} id={`res-${a.id}`}
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: ouverte === a.id || choisi
                    ? "color-mix(in srgb, var(--encre) 7%, transparent)"
                    : i === curseur ? "var(--bg)" : "transparent",
                }}>
                <div className="flex gap-3 items-center px-3" style={{ minHeight: 72, flexWrap: "wrap" }}>
                  {/* vignette */}
                  <div style={{
                    width: 76, height: 52, flex: "none", borderRadius: 8, overflow: "hidden",
                    border: "1px solid var(--line)", position: "relative",
                    background: EST_SON(a.kind) ? "var(--gold-light)" : "var(--bg)",
                  }}>
                    {vig && !EST_SON(a.kind) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vig} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    {EST_SON(a.kind) && (
                      <button className="btn-icone" aria-label={joue === a.id ? `Arrêter ${a.title}` : `Écouter ${a.title}`}
                        onClick={() => basculeLecture(a)}
                        style={{ position: "absolute", inset: 0, width: "100%", color: "var(--ink)" }}>
                        {joue === a.id ? "▮▮" : "▶"}
                      </button>
                    )}
                  </div>

                  {/* corps */}
                  <button onClick={() => { setCurseur(i); mode === "selection" ? onChoisir?.(choisi ? null : a.id) : setOuverte(a.id); }}
                    className="text-left" style={{ flex: "1 1 220px", minWidth: 0, padding: "8px 0", cursor: "pointer" }}>
                    <div className="truncate" style={{ color: "var(--ink)" }}>{a.title}</div>
                    <div className="text-xs truncate" style={{ color: "var(--ink-dim)" }}>
                      {KIND_LABEL[a.kind] ?? a.kind}
                      {d ? ` · ${d}` : ""} · {mo(a.size_bytes)} · {jour(a.created_at)}
                    </div>
                  </button>

                  {/* ambiances, en lecture : le classement se fait dans la fiche */}
                  <div className="flex gap-1 flex-wrap text-xs" style={{ flex: "0 1 auto" }}>
                    {ambiancesDe(a).length === 0 && VIVIER.includes(a.kind) ? (
                      <span style={{ color: "var(--ink-dim)" }}>à classer</span>
                    ) : ambiancesDe(a).map((x) => (
                      <span key={x} className="chip" style={{ minHeight: 24, cursor: "default", color: "var(--encre)", borderColor: "var(--encre)" }}>
                        {LIBELLE_AMBIANCE[x] ?? x}
                      </span>
                    ))}
                  </div>

                  {/* poème : un lien, plus un éditeur */}
                  {!compact && (
                    <span className="text-xs truncate" style={{ flex: "0 1 140px", color: a.poems?.title ? "var(--encre)" : "var(--ink-dim)" }}>
                      {a.poems?.title ?? "vivier commun"}
                    </span>
                  )}

                  {mode === "gestion" ? (
                    <button className="btn-icone" aria-label={`Ouvrir la fiche de ${a.title}`}
                      onClick={() => { setCurseur(i); setOuverte(a.id); }}>⋯</button>
                  ) : (
                    <span aria-hidden style={{ color: choisi ? "var(--encre)" : "var(--line)", width: 24, textAlign: "center" }}>
                      {choisi ? "✓" : ""}
                    </span>
                  )}
                </div>

                {errLigne?.id === a.id && (
                  <div role="alert" className="px-3 pb-2 text-xs" style={{ color: "var(--danger)" }}>
                    {errLigne.msg} <button className="facette" onClick={() => charger()}>réessayer</button>
                  </div>
                )}
              </li>
            );
          })}

          {lignes.length === 0 && (
            <li className="px-3 py-8 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
              {assets.length === 0
                ? "Rien pour l'instant — dépose tes métrages, tes images et tes nappes."
                : <>Aucune ressource ne correspond aux filtres.
                    {sansTypeIlYAurait > 0 && (
                      <> Sans le filtre de type, il y en aurait <strong>{sansTypeIlYAurait}</strong>.{" "}
                        <button className="facette" onClick={() => setFiltres(new Set())}>retirer le type</button>
                      </>)}
                  </>}
            </li>
          )}
        </ul>

        <p className="sr-only" aria-live="polite">{annonce}</p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} onEnded={() => setJoue(null)} style={{ display: "none" }} />
      </div>

      {/* ————— la fiche : elle reste ouverte pendant qu'on descend la liste ————— */}
      {mode === "gestion" && active && (
        <aside className="card" style={{ alignSelf: "start", position: "sticky", top: 16 }}>
          <div className="flex items-start gap-2 mb-2">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-serif2 text-xl truncate" title={active.title}>{active.title}</div>
              <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
                {mo(active.size_bytes)} · {jour(active.created_at)}
                {fmtDuree(dureeDe(active)) ? ` · ${fmtDuree(dureeDe(active))}` : ""}
              </div>
            </div>
            <button className="btn-icone" aria-label="Fermer la fiche"
              onClick={() => { setOuverte(null); listeRef.current?.focus(); }}>✕</button>
          </div>

          {vignetteDe(active) && !EST_SON(active.kind) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vignetteDe(active)!} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 12 }} />
          )}

          <div className="label mb-1">Ambiances</div>
          <div className="flex gap-1 flex-wrap mb-3">
            {AMBIANCES.map((amb) => (
              <button key={amb.id} className="chip" title={amb.aide}
                aria-pressed={ambiancesDe(active).includes(amb.id)}
                onClick={() => basculeAmbiance(active, amb.id)}>
                {amb.label}
              </button>
            ))}
          </div>

          <label className="label" htmlFor="fiche-type">Type</label>
          <select id="fiche-type" className="mb-3" value={active.kind}
            onChange={(e) => patch(active.id, { kind: e.target.value })}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>

          <label className="label" htmlFor="fiche-poeme">Poème</label>
          <select id="fiche-poeme" className="mb-3" value={active.poem_id ?? ""}
            onChange={(e) => patch(active.id, { poem_id: e.target.value || null })}>
            <option value="">— vivier commun —</option>
            {poems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <div className="flex gap-2 flex-wrap items-center">
            <button className="btn2 text-xs" onClick={() => ouvrirOriginal(active)}>Ouvrir l&apos;original</button>
            <button className="btn2 text-xs" style={{ color: "var(--danger)" }}
              onClick={() => dialogRef.current?.showModal()}>Supprimer</button>
          </div>

          <div className="flex gap-2 mt-3">
            <button className="btn2 text-xs" disabled={iActive <= 0}
              onClick={() => { const p = lignes[iActive - 1]; if (p) { setOuverte(p.id); setCurseur(iActive - 1); } }}>‹ préc.</button>
            <button className="btn2 text-xs" disabled={iActive < 0 || iActive >= lignes.length - 1}
              onClick={() => { const s = lignes[iActive + 1]; if (s) { setOuverte(s.id); setCurseur(iActive + 1); } }}>suivante ›</button>
          </div>

          {/* La confirmation vit dans la fiche et son bouton n'est PAS là où le clic l'a ouverte :
              un double-clic ne peut pas supprimer. Focus sur Annuler, Échap referme. */}
          <dialog ref={dialogRef} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 20, maxWidth: 380, background: "var(--panel)", color: "var(--ink)" }}>
            <div className="font-serif2 text-xl mb-2">Supprimer {active.title} ?</div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-dim)" }}>
              Le fichier part du stockage et la ligne de la base. C&apos;est sans retour.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn2 text-xs" autoFocus onClick={() => dialogRef.current?.close()}>Annuler</button>
              <button className="btn text-xs" style={{ background: "var(--danger)" }}
                onClick={() => supprimer(active)}>Supprimer</button>
            </div>
          </dialog>
        </aside>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { supabase, bucketFor, PLATFORMS, STATUS_FR } from "@/lib/supabase";
import { ETAPES, etapeDe, etapeCalculee, estForcee, manqueDe, type EtapeId } from "@/lib/etapes";
import { genererCaption, captionPour } from "@/lib/caption";

// L'Atelier est une base de données de poèmes avec deux vues :
// — kanban, groupé par étape (l'étape est DÉRIVÉE des données, jamais saisie) ;
// — calendrier, groupé par date de publication.
// C'est le même cycle vu à deux moments. Cf. docs/specs/spec-refonte-ux-atelier-2026-08-23.md
//
// Le kanban tient sur UNE ligne et défile horizontalement, comme tout kanban : empiler les
// colonnes sur deux rangées casse la lecture de gauche à droite qui fait tout son intérêt.
// Le détail s'ouvre en fenêtre, pas en accordéon dans une carte de 300 px.

const JOB_FR: Record<string, string> = {
  queued: "en file d'attente", running: "rendu en cours…", done: "terminé ✓", error: "erreur",
};

const RYTHME_HEURE = "18:00";
const PLATEFORMES_AUTO = ["instagram", "tiktok", "youtube"];
const LARGEUR_COLONNE = 288;
const LARGEUR_REPLIEE = 46;
const CLE_DISPOSITION = "bvh.atelier.disposition";

const jourISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Atelier() {
  const [vue, setVue] = useState<"kanban" | "calendrier">("kanban");
  const [poems, setPoems] = useState<any[]>([]);
  const [pubs, setPubs] = useState<any[]>([]);
  const [kindsByPoem, setKindsByPoem] = useState<Record<string, string[]>>({});
  const [jobsByPoem, setJobsByPoem] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // fiche ouverte (fenêtre)
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [pAssets, setPAssets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [gen, setGen] = useState({ audio_asset_id: "", image_asset_id: "", style: "cinetique" });
  const [envoiVoix, setEnvoiVoix] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newPoem, setNewPoem] = useState<any>({});

  const fenetreRef = useRef<HTMLDivElement | null>(null);
  const titreRef = useRef<HTMLInputElement | null>(null);
  const declencheurRef = useRef<HTMLElement | null>(null);

  // Disposition du kanban : préférence d'affichage pure, donc localStorage et pas la base.
  // Lue dans un effet et non à l'initialisation de l'état, sinon le HTML rendu côté serveur
  // ne correspond pas à celui du navigateur (erreur d'hydratation).
  const [ordre, setOrdre] = useState<EtapeId[]>(ETAPES.map((e) => e.id));
  const [repliees, setRepliees] = useState<Set<EtapeId>>(new Set());
  const [glisse, setGlisse] = useState<EtapeId | null>(null);
  const [glisseCarte, setGlisseCarte] = useState<string | null>(null);

  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_DISPOSITION);
      if (!brut) return;
      const d = JSON.parse(brut);
      // On repart des ETAPES pour ne jamais perdre une colonne ajoutée depuis, ni en garder
      // une qui n'existe plus.
      const connues = ETAPES.map((e) => e.id);
      const rangees = (d.ordre ?? []).filter((x: EtapeId) => connues.includes(x));
      setOrdre([...rangees, ...connues.filter((x) => !rangees.includes(x))]);
      setRepliees(new Set((d.repliees ?? []).filter((x: EtapeId) => connues.includes(x))));
    } catch { /* préférence illisible : on garde la disposition par défaut */ }
  }, []);

  function enregistrerDisposition(o: EtapeId[], r: Set<EtapeId>) {
    try {
      localStorage.setItem(CLE_DISPOSITION, JSON.stringify({ ordre: o, repliees: [...r] }));
    } catch { /* stockage indisponible : la disposition vaudra pour cette visite seulement */ }
  }

  function deposerColonne(cible: EtapeId) {
    if (!glisse || glisse === cible) return;
    const o = ordre.filter((x) => x !== glisse);
    o.splice(o.indexOf(cible), 0, glisse);
    setOrdre(o); enregistrerDisposition(o, repliees);
    setGlisse(null);
  }

  function replier(id: EtapeId) {
    const r = new Set(repliees);
    r.has(id) ? r.delete(id) : r.add(id);
    setRepliees(r); enregistrerDisposition(ordre, r);
  }

  // ————— déplacement des cartes —————
  // Nicolas a choisi la permissivité : on peut déposer une carte dans n'importe quelle
  // colonne, même si les données disent autre chose. La contrepartie, non négociable, est
  // que ça se voie — marqueur sur la carte, étape calculée rappelée dans la fiche.
  async function deposerCarte(cible: EtapeId) {
    const id = glisseCarte;
    if (!id) return;
    setGlisseCarte(null);
    const p = poems.find((x) => x.id === id);
    if (!p) return;
    // Déposer dans la colonne que le calcul donnait déjà = revenir au calcul, pas figer.
    const valeur = etapeCalculee(p, ctxDe(p)) === cible ? null : cible;
    setPoems((L) => L.map((x) => (x.id === id ? { ...x, etape_manuelle: valeur } : x)));
    const { error } = await supabase.from("poems").update({ etape_manuelle: valeur }).eq("id", id);
    if (error) { setErr(error.message); load(); return; }
    flash(valeur ? "carte déplacée à la main" : "retour au calcul ✓");
  }

  async function rendreAuCalcul(id: string) {
    setPoems((L) => L.map((x) => (x.id === id ? { ...x, etape_manuelle: null } : x)));
    const { error } = await supabase.from("poems").update({ etape_manuelle: null }).eq("id", id);
    if (error) { setErr(error.message); load(); return; }
    setDraft((d: any) => ({ ...d, etape_manuelle: null }));
    flash("retour au calcul ✓");
  }

  function reinitialiserDisposition() {
    const o = ETAPES.map((e) => e.id);
    setOrdre(o); setRepliees(new Set()); enregistrerDisposition(o, new Set());
  }

  // calendrier
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hover, setHover] = useState<number | null>(null);
  const [focusJour, setFocusJour] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poem_id: "", platform: "instagram", date: "", time: RYTHME_HEURE, caption: "" });
  const [picker, setPicker] = useState<{ pubId: string; vids: any[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // auto-programmation
  const [autoCrees, setAutoCrees] = useState<{ ids: string[]; titres: string[] } | null>(null);
  const [autoPropose, setAutoPropose] = useState<{ poemes: any[]; titres: string[] } | null>(null);
  const [autoExamine, setAutoExamine] = useState(false);

  function flash(msg: string) { setSaved(msg); setTimeout(() => setSaved(null), 2000); }

  async function load() {
    const { data, error } = await supabase.from("poems").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setPoems(data ?? []);

    const { data: a } = await supabase.from("assets").select("poem_id, kind");
    const kmap: Record<string, string[]> = {};
    (a ?? []).forEach((x: any) => { if (x.poem_id) (kmap[x.poem_id] ??= []).push(x.kind); });
    setKindsByPoem(kmap);

    const { data: j } = await supabase.from("render_jobs").select("poem_id, status");
    const jmap: Record<string, string[]> = {};
    (j ?? []).forEach((x: any) => { if (x.poem_id) (jmap[x.poem_id] ??= []).push(x.status); });
    setJobsByPoem(jmap);

    const { data: pu, error: e2 } = await supabase.from("publications")
      .select("*, poems(id, title, author, body), assets:video_asset_id(id, title, storage_bucket, storage_path)")
      .neq("status", "cancelled").order("scheduled_at");
    if (e2) { setErr(e2.message); return; }
    setPubs(pu ?? []);
    return { poems: data ?? [], pubs: pu ?? [], kinds: kmap };
  }
  useEffect(() => { load(); }, []);

  // Échap ferme la fenêtre, Tab y reste enfermé.
  // Volontairement sans tableau de dépendances : `fermer` lit `draft` et `poems` pour
  // détecter les modifications non enregistrées. Avec des dépendances figées, la fermeture
  // travaillerait sur une closure périmée et perdrait les modifications sans prévenir.
  //
  // Sans piège à focus, Tab sort de la fenêtre et parcourt le kanban resté derrière : au
  // clavier on tape alors dans une page qu'on ne voit plus. `aria-modal` le dit aux
  // lecteurs d'écran mais n'empêche rien — il faut l'implémenter.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { fermer(); return; }
      if (e.key !== "Tab") return;
      const racine = fenetreRef.current;
      if (!racine) return;
      const cibles = [...racine.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.offsetParent !== null);
      if (!cibles.length) return;
      const premier = cibles[0], dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // À l'ouverture, le focus entre dans la fenêtre ; à la fermeture, il revient sur la carte
  // d'où l'on vient. Sans ça il repart au tout début de la page à chaque aller-retour.
  useEffect(() => {
    if (open) { declencheurRef.current = document.activeElement as HTMLElement | null; return; }
    declencheurRef.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Le titre plutôt que le bouton Fermer : on ouvre une fiche pour la lire, et le lecteur
    // d'écran annonce ainsi de quel poème il s'agit.
    titreRef.current?.focus();
  }, [open]);

  function ctxDe(p: any) {
    return {
      kinds: kindsByPoem[p.id] ?? [],
      jobs: jobsByPoem[p.id] ?? [],
      pubs: pubs.filter((x) => (x.poems?.id ?? x.poem_id) === p.id).map((x) => x.status),
    };
  }

  // ————— auto-programmation : on annonce avant d'écrire —————
  async function examinerAuto() {
    const r = await load();
    if (!r) return;
    const { poems: Poemes, pubs: P, kinds } = r;
    const dejaProgrammes = new Set(P.map((p: any) => p.poems?.id ?? p.poem_id));
    const candidats = [...Poemes].reverse()
      .filter((p: any) => (kinds[p.id] ?? []).includes("video") && !dejaProgrammes.has(p.id));
    setAutoExamine(true);
    if (!candidats.length) return;

    const occupes = new Set(P.map((p: any) => jourISO(new Date(p.scheduled_at))));
    const curseur = new Date(); curseur.setHours(0, 0, 0, 0); curseur.setDate(curseur.getDate() + 1);
    const titres: string[] = [];
    for (const poeme of candidats) {
      while (occupes.has(jourISO(curseur))) curseur.setDate(curseur.getDate() + 1);
      occupes.add(jourISO(curseur));
      titres.push(`${poeme.title} — ${curseur.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`);
      curseur.setDate(curseur.getDate() + 1);
    }
    setAutoPropose({ poemes: candidats, titres });
  }
  useEffect(() => { if (!autoExamine) examinerAuto(); }, [autoExamine]);

  async function confirmerAuto() {
    if (!autoPropose) return;
    const occupes = new Set(pubs.map((p: any) => jourISO(new Date(p.scheduled_at))));
    const curseur = new Date(); curseur.setHours(0, 0, 0, 0); curseur.setDate(curseur.getDate() + 1);
    const { data: { user } } = await supabase.auth.getUser();
    const lignes: any[] = [], titres: string[] = [];
    for (const poeme of autoPropose.poemes) {
      while (occupes.has(jourISO(curseur))) curseur.setDate(curseur.getDate() + 1);
      const jour = jourISO(curseur);
      occupes.add(jour);
      const quand = new Date(`${jour}T${RYTHME_HEURE}:00`).toISOString();
      for (const plat of PLATEFORMES_AUTO) {
        lignes.push({
          poem_id: poeme.id, platform: plat, scheduled_at: quand, status: "draft",
          caption: captionPour(poeme, plat), created_by: user?.id,
        });
      }
      titres.push(`${poeme.title} — ${new Date(quand).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`);
      curseur.setDate(curseur.getDate() + 1);
    }
    const { data: ins, error } = await supabase.from("publications").insert(lignes).select("id");
    setAutoPropose(null);
    if (error) { setErr(error.message); return; }
    setAutoCrees({ ids: (ins ?? []).map((x: any) => x.id), titres });
    load();
  }

  async function annulerAuto() {
    if (!autoCrees) return;
    await supabase.from("publications").delete().in("id", autoCrees.ids);
    setAutoCrees(null); load();
  }

  // ————— fiche —————
  async function loadExtras(poemId: string) {
    const { data: a } = await supabase.from("assets").select("id, kind, title").eq("poem_id", poemId);
    setPAssets(a ?? []);
    const { data: j } = await supabase.from("render_jobs").select("*").eq("poem_id", poemId)
      .order("created_at", { ascending: false }).limit(5);
    setJobs(j ?? []);
    setGen({
      audio_asset_id: (a ?? []).find((x: any) => x.kind === "audio")?.id ?? "",
      image_asset_id: (a ?? []).find((x: any) => x.kind === "image")?.id ?? "",
      style: "cinetique",
    });
  }

  function dirty() {
    const orig = poems.find((p) => p.id === open);
    if (!orig) return false;
    return ["title", "author", "body", "caption"].some((k) => (draft[k] ?? "") !== (orig[k] ?? ""));
  }

  function fermer() {
    if (dirty() && !confirm("Modifications non enregistrées. Les abandonner ?")) return;
    setOpen(null);
  }

  function ouvrir(p: any) {
    setOpen(p.id); setDraft(p); loadExtras(p.id);
  }

  async function save(id: string) {
    // Une caption vidée redevient NULL, pas une chaîne vide : `captionPour` teste la présence,
    // et une chaîne vide qui traîne ferait croire à une caption écrite à la main.
    const { error } = await supabase.from("poems").update({
      title: draft.title, author: draft.author, body: draft.body,
      caption: (draft.caption ?? "").trim() || null,
    }).eq("id", id);
    if (error) { setErr(error.message); return; }
    flash("enregistré ✓"); setOpen(null); load();
  }

  // Changer l'étape depuis la fiche. C'est le chemin CLAVIER du forçage : le glisser-déposer
  // du kanban n'existe qu'à la souris, et une fonctionnalité qui n'a pas d'équivalent au
  // clavier n'existe pas pour qui n'en utilise pas (WCAG 2.1.1). Même règle qu'au dépôt d'une
  // carte : choisir l'étape que le calcul donnait déjà remet `etape_manuelle` à NULL.
  async function changerEtape(p: any, cible: EtapeId) {
    const valeur = etapeCalculee(p, ctxDe(p)) === cible ? null : cible;
    setPoems((L) => L.map((x) => (x.id === p.id ? { ...x, etape_manuelle: valeur } : x)));
    setDraft((d: any) => ({ ...d, etape_manuelle: valeur }));
    const { error } = await supabase.from("poems").update({ etape_manuelle: valeur }).eq("id", p.id);
    if (error) { setErr(error.message); load(); return; }
    flash(valeur ? "carte déplacée à la main" : "retour au calcul ✓");
  }

  async function create(e: any) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("poems")
      .insert({ title: newPoem.title, author: newPoem.author, body: newPoem.body ?? "", created_by: user?.id });
    if (error) { setErr(error.message); return; }
    setCreating(false); setNewPoem({}); load();
  }

  async function uploadVoix(poemId: string, file: File) {
    setEnvoiVoix(true);
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bucket = file.type.startsWith("audio/") ? "audios" : bucketFor(file.type);
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { setErr(error.message); setEnvoiVoix(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e2 } = await supabase.from("assets").insert({
      poem_id: poemId, kind: "audio", title: file.name, storage_bucket: bucket,
      storage_path: path, mime_type: file.type, size_bytes: file.size, created_by: user?.id,
    });
    setEnvoiVoix(false);
    if (e2) { setErr(e2.message); return; }
    flash("voix déposée ✓");
    loadExtras(poemId); load();
  }

  async function launchRender(p: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("render_jobs").insert({
      poem_id: p.id, audio_asset_id: gen.audio_asset_id,
      image_asset_id: gen.image_asset_id || null, style: gen.style, created_by: user?.id,
    });
    if (error) { setErr(error.message); return; }
    flash("rendu lancé — l'usine passe toutes les 2 h");
    loadExtras(p.id); load();
  }

  // ————— publications —————
  async function createPub(e: any) {
    e.preventDefault();
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
    const poeme = poems.find((p) => p.id === form.poem_id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("publications").insert({
      poem_id: form.poem_id, platform: form.platform, scheduled_at,
      caption: form.caption || (poeme ? captionPour(poeme, form.platform) : ""),
      created_by: user?.id,
    });
    if (error) { setErr(error.message); return; }
    setShowForm(false); setForm({ ...form, caption: "" }); load();
  }

  async function setStatus(p: any, status: string) {
    const patch: any = { status };
    if (status === "published") {
      patch.published_url = prompt("URL de la publication (optionnel) :") || null;
      patch.published_at = new Date().toISOString();
    }
    await supabase.from("publications").update(patch).eq("id", p.id);
    load();
  }

  // « Régénérer » veut dire : revenir au gabarit. On appelle donc `genererCaption` et non
  // `captionPour` — sinon le bouton réécrirait la caption du poème par-dessus elle-même et
  // ne servirait à rien quand c'est justement d'elle qu'on veut sortir.
  async function regenererCaption(p: any) {
    await supabase.from("publications").update({ caption: genererCaption(p.poems ?? {}, p.platform) }).eq("id", p.id);
    flash("caption régénérée ✓"); load();
  }

  async function openPicker(p: any) {
    const { data: vids, error } = await supabase.from("assets")
      .select("id, title").eq("kind", "video").eq("poem_id", p.poems?.id).order("created_at");
    if (error) { setErr(error.message); return; }
    setPicker({ pubId: p.id, vids: vids ?? [] });
  }

  async function chooseVideo(pubId: string, videoId: string) {
    await supabase.from("publications").update({ video_asset_id: videoId }).eq("id", pubId);
    setPicker(null); load();
  }

  async function download(a: any) {
    const { data } = await supabase.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  // ————— dérivés —————
  const parEtape: Record<EtapeId, any[]> = {
    preparer: [], rendre: [], rendu: [], programmer: [], programme: [], publie: [],
  };
  poems.forEach((p) => { parEtape[etapeDe(p, ctxDe(p))].push(p); });
  parEtape.publie = parEtape.publie.slice(0, 10);

  const poemeOuvert = poems.find((p) => p.id === open);
  const pubsOuvert = open ? pubs.filter((x) => (x.poems?.id ?? x.poem_id) === open) : [];

  const firstDay = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => (i < firstDay ? null : i - firstDay + 1));
  const monthPubs = pubs.filter((p) => {
    const d = new Date(p.scheduled_at);
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  });
  const upcoming = pubs.filter((p) => p.status !== "published");

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <h1 className="font-serif2 text-3xl">Atelier</h1>
        <div className="flex gap-2">
          {(["kanban", "calendrier"] as const).map((v) => (
            <button key={v} onClick={() => setVue(v)} aria-pressed={vue === v}
              className="text-xs rounded-lg px-3 py-1.5 capitalize"
              style={{ border: `1px solid ${vue === v ? "var(--gold)" : "var(--line)"}`, color: vue === v ? "var(--ink)" : "var(--ink-dim)" }}>
              {v}
            </button>
          ))}
        </div>
        {/* Les confirmations sont annoncées : elles disparaissent au bout de 2 s, donc qui ne
            regarde pas l'écran à cet instant précis ne saura jamais si l'action a abouti. */}
        <span className="text-xs" style={{ color: "var(--gold)" }} aria-live="polite">{saved}</span>
        <button className="btn ml-auto" onClick={() => { setCreating(!creating); setNewPoem({}); }}>+ Poème</button>
      </div>

      {err && <div role="alert" className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Erreur : {err}</div>}

      {autoPropose && autoPropose.poemes.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: "2px solid var(--gold)" }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="label">À programmer — {autoPropose.poemes.length} vidéo{autoPropose.poemes.length > 1 ? "s" : ""} prête{autoPropose.poemes.length > 1 ? "s" : ""}</span>
            <button className="btn text-xs ml-auto" onClick={confirmerAuto}>programmer</button>
            <button className="btn2 text-xs" onClick={() => setAutoPropose(null)}>plus tard</button>
          </div>
          {autoPropose.titres.map((t) => <div key={t} className="text-sm" style={{ color: "var(--ink-dim)" }}>{t}</div>)}
          <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
            Un poème par jour à {RYTHME_HEURE}, sur les trois plateformes, caption pré-remplie.
            Rien n&apos;est écrit tant que tu n&apos;as pas cliqué.
          </p>
        </div>
      )}

      {autoCrees && autoCrees.ids.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: "2px solid var(--gold)" }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="label">Programmé</span>
            <button className="btn2 text-xs ml-auto" onClick={annulerAuto}>tout annuler</button>
          </div>
          {autoCrees.titres.map((t) => <div key={t} className="text-sm" style={{ color: "var(--ink-dim)" }}>{t}</div>)}
        </div>
      )}

      {creating && (
        <form onSubmit={create} className="card mb-4 grid gap-3" style={{ maxWidth: 640 }}>
          <input required placeholder="Titre" value={newPoem.title ?? ""} onChange={(e) => setNewPoem({ ...newPoem, title: e.target.value })} />
          <input required placeholder="Auteur" value={newPoem.author ?? ""} onChange={(e) => setNewPoem({ ...newPoem, author: e.target.value })} />
          <textarea rows={6} placeholder="Texte du poème (édition de référence) — un vers par ligne" value={newPoem.body ?? ""} onChange={(e) => setNewPoem({ ...newPoem, body: e.target.value })} />
          <button className="btn">Créer</button>
        </form>
      )}

      {vue === "kanban" ? (
        poems.length === 0 && !creating ? (
          <p style={{ color: "var(--ink-dim)" }}>Aucun poème pour l&apos;instant — ajoute le premier.</p>
        ) : (
          // Une seule ligne, défilement horizontal : c'est ce qui fait un kanban.
          <>
            <div className="flex justify-end mb-2">
              <button className="text-xs" style={{ color: "var(--ink-dim)" }} onClick={reinitialiserDisposition}>
                réinitialiser la disposition
              </button>
            </div>
            <div style={{ overflowX: "auto", paddingBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: "min-content" }}>
                {ordre.map((id) => {
                  const etape = ETAPES.find((e) => e.id === id)!;
                  const liste = parEtape[id];
                  const repliee = repliees.has(id);
                  const largeur = repliee ? LARGEUR_REPLIEE : LARGEUR_COLONNE;
                  return (
                    <div key={id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { glisseCarte ? deposerCarte(id) : deposerColonne(id); }}
                      style={{
                        width: largeur, flex: `0 0 ${largeur}px`,
                        background: glisseCarte ? "color-mix(in srgb, var(--gold) 5%, var(--panel))" : "var(--panel)",
                        border: `1px solid ${glisse === id || glisseCarte ? "var(--gold)" : "var(--line)"}`,
                        borderRadius: 12, padding: repliee ? 8 : 10,
                        opacity: glisse && glisse !== id ? 0.75 : 1,
                      }}>
                      {repliee ? (
                        <button type="button" onClick={() => replier(id)} aria-expanded={false}
                          aria-label={`Déplier « ${etape.titre} » — ${liste.length} poème${liste.length > 1 ? "s" : ""}`}
                          className="w-full flex flex-col items-center gap-2 py-1">
                          <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{liste.length}</span>
                          <span className="label" style={{ writingMode: "vertical-rl", letterSpacing: ".1em" }}>
                            {etape.titre}
                          </span>
                        </button>
                      ) : (
                        <>
                          <div draggable onDragStart={() => setGlisse(id)} onDragEnd={() => setGlisse(null)}
                            className="flex items-center gap-2 mb-3 px-1"
                            style={{ cursor: "grab" }} title="Glisser pour déplacer la colonne">
                            <span className="label">{etape.titre}</span>
                            <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{liste.length}</span>
                            <button type="button" onClick={() => replier(id)} aria-expanded
                              aria-label={`Replier « ${etape.titre} »`}
                              className="ml-auto btn-icone">–</button>
                          </div>
                          <div className="grid gap-2">
                            {liste.map((p) => {
                              const manque = manqueDe(p, ctxDe(p));
                              const forcee = estForcee(p, ctxDe(p));
                              return (
                                <div key={p.id} draggable
                                  onDragStart={(e) => { e.stopPropagation(); setGlisseCarte(p.id); }}
                                  onDragEnd={() => setGlisseCarte(null)}
                                  style={{ cursor: "grab", opacity: glisseCarte === p.id ? 0.4 : 1 }}>
                                  <button type="button" onClick={() => ouvrir(p)}
                                    className="w-full text-left rounded-lg px-3 py-2.5"
                                    style={{
                                      background: "var(--bg)",
                                      border: `1px solid ${forcee ? "var(--gold)" : "var(--line)"}`,
                                      borderLeft: forcee ? "3px solid var(--gold)" : undefined,
                                    }}>
                                    <div className="font-serif2 text-lg leading-tight">{p.title}</div>
                                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{p.author}</div>
                                    {/* Le marqueur : sans lui on recréerait poems.status en silence. */}
                                    {forcee && (
                                      <div className="text-xs mt-1.5" style={{ color: "var(--gold)" }}>
                                        déplacée à la main — en réalité «&nbsp;
                                        {ETAPES.find((e) => e.id === etapeCalculee(p, ctxDe(p)))?.titre.toLowerCase()}&nbsp;»
                                      </div>
                                    )}
                                    {!forcee && manque && (
                                      <div className="text-xs mt-1.5" style={{ color: "var(--gold)" }}>{manque}</div>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                            {liste.length === 0 && (
                              <p className="text-xs px-1 py-2" style={{ color: "var(--ink-dim)" }}>—</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mois précédent">←</button>
            <span className="font-serif2 text-xl capitalize">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
            <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mois suivant">→</button>
            <button className="btn ml-auto" onClick={() => setShowForm(!showForm)}>+ Programmer</button>
          </div>

          {showForm && (
            <form onSubmit={createPub} className="card mb-6 grid gap-3 md:grid-cols-2" style={{ maxWidth: 760 }}>
              <div><div className="label mb-1">Poème</div>
                <select required value={form.poem_id} onChange={(e) => setForm({ ...form, poem_id: e.target.value })}>
                  <option value="">— choisir —</option>
                  {poems.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.author}</option>)}
                </select></div>
              <div><div className="label mb-1">Plateforme</div>
                <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                </select></div>
              <div><div className="label mb-1">Date</div><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><div className="label mb-1">Heure</div><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              <div className="md:col-span-2"><div className="label mb-1">Caption — laissée vide, elle est générée depuis le poème</div>
                <textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></div>
              <button className="btn md:col-span-2">Programmer</button>
            </form>
          )}

          <div className="grid grid-cols-7 gap-px text-xs mb-1" style={{ color: "var(--ink-dim)" }}>
            {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => <div key={d} className="p-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden mb-10" style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
            {/* Chaque jour est un vrai bouton. En div avec onClick, la seule façon de programmer
                depuis le calendrier était de cliquer : rien au clavier, et l'invite
                « + programmer » n'apparaissait qu'au survol — donc jamais sur un écran tactile.
                Elle est maintenant affichée dès que le jour a le focus. */}
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-24" style={{ background: "var(--panel)" }} />;
              const dayPubs = monthPubs.filter((p) => new Date(p.scheduled_at).getDate() === day);
              const iso = jourISO(new Date(month.getFullYear(), month.getMonth(), day));
              const marque = day === hover || day === focusJour;
              const dateLisible = new Date(month.getFullYear(), month.getMonth(), day)
                .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
              return (
                <button key={i} type="button" className="min-h-24 p-1.5 text-left block w-full"
                  style={{ background: marque ? "var(--bg)" : "var(--panel)" }}
                  aria-label={dayPubs.length
                    ? `${dateLisible} — ${dayPubs.length} publication${dayPubs.length > 1 ? "s" : ""} : ${dayPubs.map((p) => `${PLATFORMS[p.platform].name}, ${p.poems?.title}, ${STATUS_FR[p.status]}`).join(" ; ")}`
                    : `${dateLisible} — libre, programmer une publication`}
                  onMouseEnter={() => setHover(day)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setFocusJour(day)} onBlur={() => setFocusJour(null)}
                  onClick={() => { setForm({ ...form, date: iso }); setShowForm(true); }}>
                  <div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>{day}</div>
                  {dayPubs.map((p) => (
                    <div key={p.id} className="rounded px-1.5 py-0.5 mb-1 text-[11px] leading-tight"
                      style={{ background: PLATFORMS[p.platform].color + (p.status === "published" ? "55" : "22"), color: "var(--ink)", borderLeft: `3px solid ${PLATFORMS[p.platform].color}` }}>
                      {PLATFORMS[p.platform].short} · {p.poems?.title}
                    </div>
                  ))}
                  {marque && dayPubs.length === 0 && (
                    <div className="text-[11px] leading-tight" style={{ color: "var(--gold)" }} aria-hidden>+ programmer</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="label mb-2">En attente de publication</div>
          <div className="grid gap-4" style={{ maxWidth: 900 }}>
            {upcoming.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span className="pastille">
                    <span className="point" style={{ background: PLATFORMS[p.platform].color }} />
                    {PLATFORMS[p.platform].name}
                  </span>
                  <span className="font-serif2 text-xl">{p.poems?.title}</span>
                  <span style={{ color: "var(--ink-dim)" }}>{p.poems?.author}</span>
                  <span className="ml-auto text-sm" style={{ color: "var(--ink-dim)" }}>
                    {new Date(p.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {new Date(p.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="label">{STATUS_FR[p.status]}</span>
                </div>
                <textarea rows={4} defaultValue={p.caption} placeholder="Caption + hashtags…" className="mb-3"
                  onBlur={(e) => supabase.from("publications").update({ caption: e.target.value }).eq("id", p.id)} />
                <div className="flex gap-2 flex-wrap">
                  <button className="btn2 text-xs" onClick={async () => { await navigator.clipboard.writeText(p.caption ?? ""); setCopied(p.id); setTimeout(() => setCopied(null), 1500); }}>
                    {copied === p.id ? "copié ✓" : "copier la caption"}</button>
                  <button className="btn2 text-xs" onClick={() => regenererCaption(p)}>régénérer la caption</button>
                  {p.assets && <button className="btn2 text-xs" onClick={() => download(p.assets)}>télécharger la vidéo</button>}
                  <button className="btn2 text-xs" onClick={() => openPicker(p)}>{p.assets ? "changer de vidéo" : "lier une vidéo"}</button>
                  {p.status === "draft" && <button className="btn2 text-xs" onClick={() => setStatus(p, "ready")}>marquer prêt</button>}
                  <button className="btn text-xs" onClick={() => setStatus(p, "published")}>✓ publié</button>
                  <button className="btn2 text-xs" onClick={() => setStatus(p, "cancelled")}>annuler</button>
                </div>
                {picker?.pubId === p.id && (
                  <div className="mt-3 grid gap-2 rounded-lg p-3" style={{ border: "1px solid var(--line)" }}>
                    <div className="label">Choisir la vidéo</div>
                    {picker.vids.length === 0
                      ? <p className="text-xs" style={{ color: "var(--ink-dim)" }}>Aucune vidéo liée à ce poème.</p>
                      : picker.vids.map((v) => (
                        <button key={v.id} className="btn2 text-xs text-left"
                          style={v.id === p.assets?.id ? { borderColor: "var(--gold)", color: "var(--ink)" } : undefined}
                          onClick={() => chooseVideo(p.id, v.id)}>{v.title}</button>
                      ))}
                    <button className="text-xs text-left" style={{ color: "var(--ink-dim)" }} onClick={() => setPicker(null)}>annuler</button>
                  </div>
                )}
              </div>
            ))}
            {upcoming.length === 0 && <p style={{ color: "var(--ink-dim)" }}>Rien en attente.</p>}
          </div>
        </>
      )}

      {/* ————— la fiche, en fenêtre ————— */}
      {poemeOuvert && (
        <div role="dialog" aria-modal="true" aria-label={poemeOuvert.title}
          onClick={(e) => { if (e.currentTarget === e.target) fermer(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 50, display: "flex",
            alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px",
            background: "color-mix(in srgb, var(--ink) 45%, transparent)",
          }}>
          <div ref={fenetreRef} onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 880, maxHeight: "90vh", overflowY: "auto",
              background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16,
              padding: 24,
            }}>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              {/* Le sélecteur d'étape est le pendant clavier du glisser-déposer. Il porte la
                  même règle : choisir l'étape calculée revient au calcul. */}
              <label className="flex items-center gap-2">
                <span className="label">Étape</span>
                <select style={{ width: "auto" }}
                  value={etapeDe(poemeOuvert, ctxDe(poemeOuvert))}
                  onChange={(e) => changerEtape(poemeOuvert, e.target.value as EtapeId)}>
                  {ETAPES.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.titre}{et.id === etapeCalculee(poemeOuvert, ctxDe(poemeOuvert)) ? " (calculée)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {/* L'étape calculée reste toujours lisible : c'est ce qui empêche le forçage
                  de devenir un mensonge silencieux. */}
              {estForcee(poemeOuvert, ctxDe(poemeOuvert)) && (
                <>
                  <span className="text-xs" style={{ color: "var(--gold)" }}>
                    déplacée à la main — les données disent «&nbsp;
                    {ETAPES.find((e) => e.id === etapeCalculee(poemeOuvert, ctxDe(poemeOuvert)))?.titre.toLowerCase()}&nbsp;»
                  </span>
                  <button className="btn2 text-xs" onClick={() => rendreAuCalcul(poemeOuvert.id)}>
                    revenir au calcul
                  </button>
                </>
              )}
              <button className="btn2 text-xs ml-auto" onClick={fermer}>Fermer ✕</button>
            </div>

            <input ref={titreRef} className="mb-3" value={draft.title ?? ""} placeholder="Titre" aria-label="Titre du poème"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28, border: "none", background: "transparent", padding: 0 }}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <input className="mb-4" value={draft.author ?? ""} placeholder="Auteur" aria-label="Auteur"
              style={{ border: "none", background: "transparent", padding: 0, color: "var(--ink-dim)" }}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })} />

            <label className="label mb-1 block" htmlFor="champ-texte">Texte — un vers par ligne, il sert aux sous-titres</label>
            <textarea id="champ-texte" rows={16} className="mb-4" value={draft.body ?? ""}
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 17, lineHeight: 1.6 }}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })} />

            {/* La caption vit ici depuis le 24/08, et non plus seulement sur la publication :
                elle se pense en lisant le poème, pas en choisissant un créneau. */}
            <label className="label mb-1 block" htmlFor="champ-caption">Caption</label>
            <textarea id="champ-caption" rows={5} className="mb-1" value={draft.caption ?? ""}
              placeholder={poemeOuvert ? genererCaption(poemeOuvert, "instagram") : ""}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
            <div className="flex gap-3 items-center flex-wrap mb-4">
              <button type="button" className="btn2 text-xs"
                onClick={() => setDraft({ ...draft, caption: genererCaption(poemeOuvert, "instagram") })}>
                partir du gabarit
              </button>
              {(draft.caption ?? "").trim() && (
                <button type="button" className="btn2 text-xs"
                  onClick={() => setDraft({ ...draft, caption: "" })}>revenir au gabarit</button>
              )}
              <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
                {(draft.caption ?? "").trim()
                  ? "Écrite à la main : elle sera reprise telle quelle sur les trois plateformes, hashtags compris."
                  : "Vide : le gabarit s'applique, avec les hashtags propres à chaque plateforme."}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div>
                <div className="label mb-1">Voix</div>
                {pAssets.filter((a) => a.kind === "audio").length > 0 ? (
                  <select value={gen.audio_asset_id} onChange={(e) => setGen({ ...gen, audio_asset_id: e.target.value })}>
                    <option value="">— aucune —</option>
                    {pAssets.filter((a) => a.kind === "audio").map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                ) : (
                  <label className="btn2 text-xs inline-block cursor-pointer">
                    {envoiVoix ? "envoi…" : "déposer l'enregistrement"}
                    <input type="file" accept="audio/*" style={{ display: "none" }} disabled={envoiVoix}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVoix(poemeOuvert.id, f); e.currentTarget.value = ""; }} />
                  </label>
                )}
              </div>
              <div>
                <div className="label mb-1">Image de fond</div>
                <select value={gen.image_asset_id} onChange={(e) => setGen({ ...gen, image_asset_id: e.target.value })}>
                  <option value="">— fond généré —</option>
                  {pAssets.filter((a) => a.kind === "image").map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
            </div>

            {/* Le rendu exige un fond depuis le 23/08 : sans image ni métrage lié, `render.py`
                échoue volontairement plutôt que de fabriquer une image de secours ratée. */}
            {draft.body?.trim() && gen.audio_asset_id &&
             !(kindsByPoem[poemeOuvert.id] ?? []).includes("image") &&
             !(kindsByPoem[poemeOuvert.id] ?? []).includes("broll") && (
              <div className="border-t pt-4 mb-4" style={{ borderColor: "var(--line)" }}>
                <div className="label mb-1">Générer la vidéo</div>
                <p className="text-sm" style={{ color: "var(--gold)" }}>
                  Il manque un fond. Lie une image ou du métrage à ce poème depuis les
                  Ressources — le rendu ne part pas sans, et c'est voulu.
                </p>
              </div>
            )}

            {draft.body?.trim() && gen.audio_asset_id &&
             ((kindsByPoem[poemeOuvert.id] ?? []).includes("image") ||
              (kindsByPoem[poemeOuvert.id] ?? []).includes("broll")) && (
              <div className="border-t pt-4 mb-4" style={{ borderColor: "var(--line)" }}>
                <div className="flex gap-3 items-end flex-wrap">
                  <div style={{ maxWidth: 260, flex: 1 }}>
                    <div className="label mb-1">Direction artistique</div>
                    <select value={gen.style} onChange={(e) => setGen({ ...gen, style: e.target.value })}>
                      <option value="cinetique">Cinétique (mots sur la voix)</option>
                      <option value="musee">Musée (plein écran)</option>
                      <option value="galerie">Galerie (cadre doré)</option>
                    </select>
                  </div>
                  <button className="btn" onClick={() => launchRender(poemeOuvert)}>Générer la vidéo</button>
                </div>
                {jobs.length > 0 && (
                  <div className="mt-3 grid gap-1">
                    {jobs.map((j) => (
                      <div key={j.id} className="text-xs flex gap-3" style={{ color: j.status === "error" ? "var(--danger)" : "var(--ink-dim)" }}>
                        <span>{new Date(j.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span>{j.style}</span><span>{JOB_FR[j.status]}</span>
                        {j.error && <span>· {j.error.slice(0, 120)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pubsOuvert.length > 0 && (
              <div className="border-t pt-4 mb-4" style={{ borderColor: "var(--line)" }}>
                <div className="label mb-2">Publications</div>
                {pubsOuvert.map((p) => (
                  <div key={p.id} className="flex gap-3 items-center text-sm py-1 flex-wrap">
                    <span className="pastille">
                      <span className="point" style={{ background: PLATFORMS[p.platform].color }} />
                      {PLATFORMS[p.platform].name}
                    </span>
                    <span style={{ color: "var(--ink-dim)" }}>
                      {new Date(p.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <span className="label">{STATUS_FR[p.status]}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 flex-wrap border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <button className="btn" onClick={() => save(poemeOuvert.id)}>Enregistrer</button>
              <button className="btn2" onClick={fermer}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { supabase, bucketFor, PLATFORMS, STATUS_FR } from "@/lib/supabase";
import { ETAPES, etapeDe, manqueDe, type EtapeId } from "@/lib/etapes";
import { genererCaption } from "@/lib/caption";

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

  // calendrier
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hover, setHover] = useState<number | null>(null);
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

  // Échap ferme la fenêtre.
  // Volontairement sans tableau de dépendances : `fermer` lit `draft` et `poems` pour
  // détecter les modifications non enregistrées. Avec des dépendances figées, la fermeture
  // travaillerait sur une closure périmée et perdrait les modifications sans prévenir.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

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
          caption: genererCaption(poeme, plat), created_by: user?.id,
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
    return ["title", "author", "body"].some((k) => (draft[k] ?? "") !== (orig[k] ?? ""));
  }

  function fermer() {
    if (dirty() && !confirm("Modifications non enregistrées. Les abandonner ?")) return;
    setOpen(null);
  }

  function ouvrir(p: any) {
    setOpen(p.id); setDraft(p); loadExtras(p.id);
  }

  async function save(id: string) {
    const { error } = await supabase.from("poems")
      .update({ title: draft.title, author: draft.author, body: draft.body }).eq("id", id);
    if (error) { setErr(error.message); return; }
    flash("enregistré ✓"); setOpen(null); load();
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
      caption: form.caption || (poeme ? genererCaption(poeme, form.platform) : ""),
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
        {saved && <span className="text-xs" style={{ color: "var(--gold)" }}>{saved}</span>}
        <button className="btn ml-auto" onClick={() => { setCreating(!creating); setNewPoem({}); }}>+ Poème</button>
      </div>

      {err && <div className="card mb-4" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Erreur : {err}</div>}

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
          <div style={{ overflowX: "auto", paddingBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: "min-content" }}>
              {ETAPES.map((etape) => {
                const liste = parEtape[etape.id];
                return (
                  <div key={etape.id}
                    style={{
                      width: LARGEUR_COLONNE, flex: `0 0 ${LARGEUR_COLONNE}px`,
                      background: "var(--panel)", border: "1px solid var(--line)",
                      borderRadius: 12, padding: 10,
                    }}>
                    <div className="flex items-baseline gap-2 mb-3 px-1">
                      <span className="label">{etape.titre}</span>
                      <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{liste.length}</span>
                    </div>
                    <div className="grid gap-2">
                      {liste.map((p) => {
                        const manque = manqueDe(p, ctxDe(p));
                        return (
                          <button key={p.id} type="button" onClick={() => ouvrir(p)}
                            className="w-full text-left rounded-lg px-3 py-2.5"
                            style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                            <div className="font-serif2 text-lg leading-tight">{p.title}</div>
                            <div className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{p.author}</div>
                            {manque && <div className="text-xs mt-1.5" style={{ color: "var(--gold)" }}>{manque}</div>}
                          </button>
                        );
                      })}
                      {liste.length === 0 && (
                        <p className="text-xs px-1 py-2" style={{ color: "var(--ink-dim)" }}>—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            {cells.map((day, i) => {
              const dayPubs = day ? monthPubs.filter((p) => new Date(p.scheduled_at).getDate() === day) : [];
              const iso = day ? jourISO(new Date(month.getFullYear(), month.getMonth(), day)) : "";
              const survol = day === hover;
              return (
                <div key={i} className="min-h-24 p-1.5"
                  style={{ background: survol ? "var(--bg)" : "var(--panel)", cursor: day ? "pointer" : "default" }}
                  onMouseEnter={() => day && setHover(day)} onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!day) return; setForm({ ...form, date: iso }); setShowForm(true); }}>
                  {day && <div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>{day}</div>}
                  {dayPubs.map((p) => (
                    <div key={p.id} className="block w-full text-left rounded px-1.5 py-0.5 mb-1 text-[10px] leading-tight"
                      style={{ background: PLATFORMS[p.platform].color + (p.status === "published" ? "55" : "22"), color: "var(--ink)", borderLeft: `2px solid ${PLATFORMS[p.platform].color}` }}
                      title={`${p.poems?.title} — ${STATUS_FR[p.status]}`}>
                      {PLATFORMS[p.platform].short} · {p.poems?.title}
                    </div>
                  ))}
                  {survol && dayPubs.length === 0 && (
                    <div className="text-[10px] leading-tight" style={{ color: "var(--gold)" }}>+ programmer</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="label mb-2">En attente de publication</div>
          <div className="grid gap-4" style={{ maxWidth: 900 }}>
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
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 880, maxHeight: "90vh", overflowY: "auto",
              background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16,
              padding: 24,
            }}>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="label">{ETAPES.find((e) => e.id === etapeDe(poemeOuvert, ctxDe(poemeOuvert)))?.titre}</span>
              <button className="btn2 text-xs ml-auto" onClick={fermer}>Fermer ✕</button>
            </div>

            <input className="mb-3" value={draft.title ?? ""} placeholder="Titre"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28, border: "none", background: "transparent", padding: 0 }}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <input className="mb-4" value={draft.author ?? ""} placeholder="Auteur"
              style={{ border: "none", background: "transparent", padding: 0, color: "var(--ink-dim)" }}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })} />

            <div className="label mb-1">Texte — un vers par ligne, il sert aux sous-titres</div>
            <textarea rows={16} className="mb-4" value={draft.body ?? ""}
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 17, lineHeight: 1.6 }}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })} />

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

            {draft.body?.trim() && gen.audio_asset_id && (
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
                    <span className="text-xs" style={{ color: PLATFORMS[p.platform].color }}>{PLATFORMS[p.platform].name}</span>
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

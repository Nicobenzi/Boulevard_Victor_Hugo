"use client";
import { useEffect, useState } from "react";
import { supabase, PLATFORMS, STATUS_FR } from "@/lib/supabase";

// Rythme visé : un poème par jour, à 18 h, sur les trois plateformes.
// ⚠ La carte de fin des vidéos dit « chaque semaine, un poème » (render.py, style SigSub).
// Si le rythme quotidien est confirmé, cette signature est à revoir.
const RYTHME_HEURE = "18:00";
const PLATEFORMES_AUTO = ["instagram", "tiktok", "youtube"];

const jourISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Publications() {
  const [vue, setVue] = useState<"calendrier" | "liste">("calendrier");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [pubs, setPubs] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poem_id: "", platform: "instagram", date: "", time: "18:00", caption: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ pubId: string; vids: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Auto-remplissage : ce qui vient d'être créé, pour pouvoir l'annuler d'un clic.
  const [autoCrees, setAutoCrees] = useState<{ ids: string[]; titres: string[] } | null>(null);
  const [autoFait, setAutoFait] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  // Une seule requête pour les deux vues : le volume est d'une poignée de lignes par mois,
  // le filtrage par mois se fait côté client (naviguer entre les mois ne recharge donc rien).
  async function load() {
    const { data, error } = await supabase.from("publications")
      .select("*, poems(id, title, author), assets:video_asset_id(id, title, storage_bucket, storage_path)")
      .neq("status", "cancelled").order("scheduled_at");
    if (error) { setErr(error.message); return; }
    setErr(null);
    setPubs(data ?? []);
    const { data: p, error: e2 } = await supabase.from("poems").select("id, title, author").order("created_at", { ascending: false });
    if (e2) { setErr(e2.message); return; }
    setPoems(p ?? []);
    return { pubs: data ?? [], poems: p ?? [] };
  }
  useEffect(() => { load(); }, []);

  // ————— auto-remplissage —————
  // Il n'y a pas de serveur : le seul moment où l'app peut agir seule est le chargement
  // de cette page. On ne programme QUE des poèmes dont la vidéo existe déjà — sans quoi
  // on remplirait le calendrier de promesses que rien ne peut tenir.
  async function autoRemplir() {
    const r = await load();
    if (!r) return;
    const { pubs: P, poems: Poemes } = r;

    const { data: vids } = await supabase.from("assets").select("poem_id").eq("kind", "video");
    const avecVideo = new Set((vids ?? []).map((v: any) => v.poem_id).filter(Boolean));
    const dejaProgrammes = new Set(P.map((p: any) => p.poems?.id ?? p.poem_id));

    const candidats = [...Poemes].reverse()
      .filter((p) => avecVideo.has(p.id) && !dejaProgrammes.has(p.id));
    if (!candidats.length) { setAutoFait(true); return; }

    const occupes = new Set(P.map((p: any) => jourISO(new Date(p.scheduled_at))));
    const curseur = new Date(); curseur.setHours(0, 0, 0, 0); curseur.setDate(curseur.getDate() + 1);

    const { data: { user } } = await supabase.auth.getUser();
    const lignes: any[] = [], titres: string[] = [];
    for (const poeme of candidats) {
      while (occupes.has(jourISO(curseur))) curseur.setDate(curseur.getDate() + 1);
      const jour = jourISO(curseur);
      occupes.add(jour);
      const quand = new Date(`${jour}T${RYTHME_HEURE}:00`).toISOString();
      for (const plat of PLATEFORMES_AUTO) {
        lignes.push({ poem_id: poeme.id, platform: plat, scheduled_at: quand, status: "draft", created_by: user?.id });
      }
      titres.push(`${poeme.title} — ${new Date(quand).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`);
      curseur.setDate(curseur.getDate() + 1);
    }

    const { data: ins, error } = await supabase.from("publications").insert(lignes).select("id");
    setAutoFait(true);
    if (error) { setErr(error.message); return; }
    setAutoCrees({ ids: (ins ?? []).map((x: any) => x.id), titres });
    load();
  }
  useEffect(() => { if (!autoFait) autoRemplir(); }, [autoFait]);

  async function annulerAuto() {
    if (!autoCrees) return;
    await supabase.from("publications").delete().in("id", autoCrees.ids);
    setAutoCrees(null); load();
  }

  // Ouvre une publication du calendrier dans la vue liste, et la met en évidence.
  useEffect(() => {
    if (!focusId || vue !== "liste") return;
    document.getElementById(`pub-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFocusId(null), 2500);
    return () => clearTimeout(t);
  }, [focusId, vue]);

  async function createPub(e: any) {
    e.preventDefault();
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("publications").insert({ poem_id: form.poem_id, platform: form.platform, scheduled_at, caption: form.caption, created_by: user?.id });
    if (error) { setErr(error.message); return; }
    setShowForm(false); setForm({ ...form, caption: "" }); load();
  }

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

  // Le pipeline produit toujours deux fichiers (avec musique / voix seule) : on les propose
  // en boutons plutôt que de demander de taper un numéro.
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

  async function download(p: any) {
    const { data } = await supabase.storage.from(p.assets.storage_bucket).createSignedUrl(p.assets.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  // — vue calendrier —
  const firstDay = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => (i < firstDay ? null : i - firstDay + 1));
  const monthName = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const monthPubs = pubs.filter((p) => {
    const d = new Date(p.scheduled_at);
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  });

  // — vue liste —
  const upcoming = pubs.filter((p) => p.status !== "published");
  const done = pubs.filter((p) => p.status === "published").slice(-5);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="font-serif2 text-3xl">Publications</h1>
        <div className="flex gap-2">
          {(["calendrier", "liste"] as const).map((v) => (
            <button key={v} onClick={() => setVue(v)} aria-pressed={vue === v}
              className="text-xs rounded-lg px-3 py-1.5 capitalize"
              style={{ border: `1px solid ${vue === v ? "var(--gold)" : "var(--line)"}`, color: vue === v ? "var(--ink)" : "var(--ink-dim)" }}>
              {v}
            </button>
          ))}
        </div>
        <button className="btn ml-auto" onClick={() => setShowForm(!showForm)}>+ Programmer</button>
      </div>

      {err && <div className="card mb-6" style={{ borderColor: "#d65454", color: "#d65454" }}>Erreur de chargement : {err}</div>}

      {autoCrees && autoCrees.ids.length > 0 && (
        <div className="card mb-6" style={{ borderLeft: "2px solid var(--gold)" }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="label">Programmé automatiquement</span>
            <button className="btn2 text-xs ml-auto" onClick={annulerAuto}>tout annuler</button>
          </div>
          {autoCrees.titres.map((t) => (
            <div key={t} className="text-sm" style={{ color: "var(--ink-dim)" }}>{t}</div>
          ))}
          <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
            Un poème par jour à {RYTHME_HEURE}, sur les trois plateformes. Seuls les poèmes dont
            la vidéo est déjà montée sont programmés.
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={createPub} className="card mb-6 grid gap-3 md:grid-cols-2">
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
          <div className="md:col-span-2"><div className="label mb-1">Caption (modifiable ensuite)</div>
            <textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></div>
          <button className="btn md:col-span-2">Programmer</button>
        </form>
      )}

      {vue === "calendrier" ? (
        <>
          <div className="flex items-center gap-3 mb-3">
            <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mois précédent">←</button>
            <span className="font-serif2 text-xl capitalize">{monthName}</span>
            <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mois suivant">→</button>
          </div>
          <div className="grid grid-cols-7 gap-px text-xs mb-1" style={{ color: "var(--ink-dim)" }}>
            {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => <div key={d} className="p-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
            {cells.map((day, i) => {
              const dayPubs = day ? monthPubs.filter((p) => new Date(p.scheduled_at).getDate() === day) : [];
              const iso = day ? jourISO(new Date(month.getFullYear(), month.getMonth(), day)) : "";
              const survol = day === hover;
              return (
                <div key={i} className="min-h-20 p-1.5 relative"
                  style={{ background: survol ? "#1c1814" : "var(--panel)", cursor: day ? "pointer" : "default" }}
                  onMouseEnter={() => day && setHover(day)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!day) return; setForm({ ...form, date: iso }); setShowForm(true); }}>
                  {day && <div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>{day}</div>}
                  {dayPubs.map((p) => (
                    <button key={p.id}
                      onClick={(e) => { e.stopPropagation(); setVue("liste"); setFocusId(p.id); }}
                      className="block w-full text-left rounded px-1.5 py-0.5 mb-1 text-[10px] leading-tight cursor-pointer"
                      style={{ background: PLATFORMS[p.platform].color + (p.status === "published" ? "55" : "22"), color: "var(--ink)", borderLeft: `2px solid ${PLATFORMS[p.platform].color}` }}
                      title={`${p.poems?.title} — ${STATUS_FR[p.status]} · ouvrir`}>
                      {PLATFORMS[p.platform].short} · {p.poems?.title}
                    </button>
                  ))}
                  {survol && dayPubs.length === 0 && (
                    <div className="text-[10px] leading-tight" style={{ color: "var(--gold)" }}>+ programmer</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4">
            {upcoming.map((p) => (
              <div key={p.id} id={`pub-${p.id}`} className="card"
                style={focusId === p.id ? { borderColor: "var(--gold)" } : undefined}>
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
                  {p.assets && <button className="btn2 text-xs" onClick={() => download(p)}>télécharger la vidéo</button>}
                  <button className="btn2 text-xs" onClick={() => openPicker(p)}>{p.assets ? "changer de vidéo" : "lier une vidéo"}</button>
                  {p.status === "draft" && <button className="btn2 text-xs" onClick={() => setStatus(p, "ready")}>marquer prêt</button>}
                  <button className="btn text-xs" onClick={() => setStatus(p, "published")}>✓ publié</button>
                  <button className="btn2 text-xs" onClick={() => setStatus(p, "cancelled")}>annuler</button>
                </div>

                {picker?.pubId === p.id && (
                  <div className="mt-3 grid gap-2 rounded-lg p-3" style={{ border: "1px solid var(--line)" }}>
                    <div className="label">Choisir la vidéo</div>
                    {picker.vids.length === 0
                      ? <p className="text-xs" style={{ color: "var(--ink-dim)" }}>Aucune vidéo liée à ce poème dans la Bibliothèque.</p>
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
            {upcoming.length === 0 && <p style={{ color: "var(--ink-dim)" }}>Rien en attente — programme une publication avec « + Programmer ».</p>}
          </div>

          {done.length > 0 && (
            <div className="mt-10">
              <div className="label mb-2">Publiées récemment</div>
              {done.map((p) => (
                <div key={p.id} id={`pub-${p.id}`} className="flex gap-3 text-sm py-1"
                  style={{ color: focusId === p.id ? "var(--ink)" : "var(--ink-dim)" }}>
                  <span>{PLATFORMS[p.platform].short}</span><span>{p.poems?.title}</span>
                  {p.published_url && <a href={p.published_url} target="_blank" style={{ color: "var(--gold)" }}>voir ↗</a>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

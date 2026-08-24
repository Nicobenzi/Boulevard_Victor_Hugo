"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ETAPES, etapeDe, type EtapeId } from "@/lib/etapes";

// L'accueil répond à UNE question : tient-on le rythme ?
// À deux personnes et un poème par jour visé, un tableau de bord qui compte les objets
// serait décoratif — la régularité de publication est la priorité du projet (memory.md § 1).

const jourISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Accueil() {
  const [poems, setPoems] = useState<any[]>([]);
  const [pubs, setPubs] = useState<any[]>([]);
  const [kinds, setKinds] = useState<Record<string, string[]>>({});
  const [jobs, setJobs] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [pret, setPret] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      // `etape_manuelle` est indispensable : sans elle, l'accueil compterait l'étape calculée
      // pendant que le kanban affiche l'étape forcée, et les deux écrans se contrediraient.
      const { data: p, error } = await supabase.from("poems").select("id, title, author, body, etape_manuelle");
      if (error) { setErr(error.message); return; }
      setPoems(p ?? []);

      const { data: a } = await supabase.from("assets").select("poem_id, kind");
      const km: Record<string, string[]> = {};
      (a ?? []).forEach((x: any) => { if (x.poem_id) (km[x.poem_id] ??= []).push(x.kind); });
      setKinds(km);

      const { data: j } = await supabase.from("render_jobs").select("poem_id, status");
      const jm: Record<string, string[]> = {};
      (j ?? []).forEach((x: any) => { if (x.poem_id) (jm[x.poem_id] ??= []).push(x.status); });
      setJobs(jm);

      const { data: pu } = await supabase.from("publications")
        .select("poem_id, status, scheduled_at").neq("status", "cancelled");
      setPubs(pu ?? []);

      // Les notes en attente. C'est LA raison d'être de ce bloc : `poems.notes` n'a jamais
      // servi parce qu'il fallait ouvrir la fiche du bon poème pour la découvrir. L'accueil
      // est le premier écran ouvert, donc le seul qu'on ne puisse pas manquer.
      // ⚠ Contrainte nommée explicitement : `notes` a deux clés étrangères vers `profiles`
      // (created_by, resolved_by), et PostgREST refuse de choisir à notre place.
      const { data: n } = await supabase.from("notes")
        .select("id, body, created_at, poem_id, poems(title), auteur:profiles!notes_created_by_fkey(display_name)")
        .is("resolved_at", null).order("created_at");
      setNotes(n ?? []);
      setPret(true);
    })();
  }, []);

  const parEtape: Record<EtapeId, number> = {
    preparer: 0, rendre: 0, rendu: 0, programmer: 0, programme: 0, publie: 0,
  };
  poems.forEach((p) => {
    const e = etapeDe(p, {
      kinds: kinds[p.id] ?? [],
      jobs: jobs[p.id] ?? [],
      pubs: pubs.filter((x) => x.poem_id === p.id).map((x) => x.status),
    });
    parEtape[e] += 1;
  });

  // Jours à venir déjà pourvus, et le premier trou.
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const joursPourvus = new Set(
    pubs.filter((p) => p.status !== "published" && new Date(p.scheduled_at) >= aujourdhui)
      .map((p) => jourISO(new Date(p.scheduled_at)))
  );

  let avance = 0;
  const curseur = new Date(aujourdhui);
  curseur.setDate(curseur.getDate() + 1);
  while (joursPourvus.has(jourISO(curseur)) && avance < 60) {
    avance += 1;
    curseur.setDate(curseur.getDate() + 1);
  }
  const prochainTrou = new Date(curseur);

  // Ce qui peut encore alimenter le calendrier sans nouveau travail de fond.
  const enReserve = parEtape.programmer;
  const tenu = avance >= 3;

  return (
    <div>
      <h1 className="font-serif2 text-3xl mb-1">Chaque jour, un poème</h1>
      <p className="mb-8 text-sm" style={{ color: "var(--ink-dim)" }}>
        {!pret ? "…" : tenu
          ? "Le rythme est tenu."
          : "Le rythme va casser — il manque de quoi remplir les prochains jours."}
      </p>

      {err && <div className="card mb-6" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Erreur : {err}</div>}

      <div className="grid gap-4 md:grid-cols-3 mb-10">
        <div className="card">
          <div className="label mb-1">Jours d&apos;avance</div>
          <div className="font-serif2 text-4xl" style={{ color: tenu ? "var(--gold)" : "var(--danger)" }}>{avance}</div>
          <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
            jours consécutifs déjà programmés à partir de demain
          </p>
        </div>
        <div className="card">
          <div className="label mb-1">Prochain jour vide</div>
          <div className="font-serif2 text-2xl capitalize">
            {prochainTrou.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>rien n&apos;y est prévu</p>
        </div>
        <div className="card">
          <div className="label mb-1">Vidéos en réserve</div>
          <div className="font-serif2 text-4xl" style={{ color: enReserve > 0 ? "var(--gold)" : "var(--ink-dim)" }}>{enReserve}</div>
          <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
            montées, pas encore programmées
          </p>
        </div>
      </div>

      {/* Ce qui attend — avant « où en est la chaîne », parce qu'une demande laissée par
          l'autre passe avant un état de la production : elle a une personne derrière. */}
      {notes.length > 0 && (
        <div className="mb-8">
          <div className="label mb-2">Ce qui attend</div>
          <div className="grid gap-2">
            {notes.map((n) => (
              <Link key={n.id} href="/atelier"
                className="card flex items-baseline gap-3 flex-wrap"
                style={{ borderLeft: "3px solid var(--gold)" }}>
                <span className="font-serif2 text-lg">{n.poems?.title}</span>
                <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
                  {n.auteur?.display_name ?? "quelqu'un"} · {new Date(n.created_at)
                    .toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                {/* Tronqué ici, jamais dans la fiche : l'accueil signale, il ne remplace pas. */}
                <span className="text-sm w-full" style={{ color: "var(--ink-dim)" }}>
                  {n.body.length > 120 ? n.body.slice(0, 120) + "…" : n.body}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="label mb-2">Où en est la chaîne</div>
      <div className="grid gap-2 mb-8">
        {ETAPES.filter((e) => e.id !== "publie").map((e) => (
          <Link key={e.id} href="/atelier" className="card flex items-center gap-3 flex-wrap">
            <span className="text-sm">{e.titre}</span>
            <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{e.action}</span>
            <span className="font-serif2 text-2xl ml-auto"
              style={{ color: parEtape[e.id] > 0 ? "var(--gold)" : "var(--ink-dim)" }}>
              {parEtape[e.id]}
            </span>
          </Link>
        ))}
      </div>

      <Link href="/atelier" className="btn inline-block">Ouvrir l&apos;atelier</Link>
    </div>
  );
}

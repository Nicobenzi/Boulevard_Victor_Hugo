// Où en est un poème ? Déduit de ce qui existe réellement en base, jamais lu dans
// `poems.status` (qui dérive dès qu'on l'oublie de mettre à jour — cf. memory.md § 4).
// Factorisé ici parce que l'Accueil et l'Atelier posent la même question.

export type EtapeId = "preparer" | "rendre" | "rendu" | "programmer" | "programme" | "publie";

export const ETAPES: { id: EtapeId; titre: string; action: string }[] = [
  { id: "preparer", titre: "À préparer", action: "coller le texte, déposer la voix" },
  { id: "rendre", titre: "Prêt à rendre", action: "générer la vidéo" },
  { id: "rendu", titre: "En rendu", action: "l'usine travaille" },
  { id: "programmer", titre: "À programmer", action: "choisir une date" },
  { id: "programme", titre: "Programmé", action: "publier le jour dit" },
  { id: "publie", titre: "Publié", action: "rien à faire" },
];

export type Contexte = {
  kinds: string[];      // types d'assets liés au poème
  jobs: string[];       // statuts des render_jobs du poème
  pubs: string[];       // statuts des publications du poème (hors annulées)
};

// L'étape RÉELLE, déduite des faits. C'est elle qui fait foi.
export function etapeCalculee(poem: { body?: string | null }, ctx: Contexte): EtapeId {
  if (!poem.body?.trim()) return "preparer";
  if (!ctx.kinds.includes("audio")) return "preparer";
  // ⚠ 24/08 — la condition « une image ou du métrage lié au poème » a été RETIRÉE d'ici.
  // Le fond n'est plus une propriété du poème mais un choix du rendu (colonne
  // `render_jobs.broll_asset_id`), pris dans un vivier commun où un même plan ressert pour
  // plusieurs poèmes. Un poème est donc prêt à rendre dès qu'il a un texte et une voix.
  // L'invariant du 23/08 — *pas de vidéo sans fond réel* — n'est pas abandonné : il est tenu
  // par le bouton « Générer », désactivé tant qu'aucun plan n'est choisi, et par le contrôle
  // de `render.py`. Il s'applique désormais au moment où la décision se prend, pas trois
  // écrans plus tôt. Cf. docs/specs/spec-montage-dans-atelier-2026-08-24.md
  if (ctx.jobs.some((s) => s === "queued" || s === "running")) return "rendu";
  if (!ctx.kinds.includes("video")) return "rendre";
  if (ctx.pubs.length === 0) return "programmer";
  if (ctx.pubs.some((s) => s !== "published")) return "programme";
  return "publie";
}

// L'étape AFFICHÉE. Si Nicolas a déplacé la carte à la main, c'est son choix qui gagne.
//
// ⚠ C'est la seule entorse au principe « l'avancement est dérivé ». Elle est assumée, mais
// elle n'est tenable qu'à une condition : que le forçage se VOIE. Une carte forcée porte un
// marqueur, et son étape calculée reste lisible dans sa fiche. Sans ça on recréerait
// exactement `poems.status` — un champ saisi qui dérive en silence et auquel plus personne
// ne se fie (cf. memory.md § 4).
export function etapeDe(poem: { body?: string | null; etape_manuelle?: string | null }, ctx: Contexte): EtapeId {
  const forcee = poem.etape_manuelle;
  if (forcee && ETAPES.some((e) => e.id === forcee)) return forcee as EtapeId;
  return etapeCalculee(poem, ctx);
}

// Vrai si l'affichage ne reflète plus les données.
export function estForcee(poem: { body?: string | null; etape_manuelle?: string | null }, ctx: Contexte): boolean {
  const f = poem.etape_manuelle;
  return !!f && ETAPES.some((e) => e.id === f) && f !== etapeCalculee(poem, ctx);
}

// Ce qui manque concrètement, pour l'afficher sur la carte sans faire deviner.
export function manqueDe(poem: { body?: string | null }, ctx: Contexte): string | null {
  if (!poem.body?.trim()) return "texte manquant";
  if (!ctx.kinds.includes("audio")) return "voix manquante";
  // « aucun fond » a disparu le 24/08 en même temps que la condition correspondante dans
  // `etapeCalculee` : le fond se choisit au montage, il ne manque donc plus au poème.
  return null;
}

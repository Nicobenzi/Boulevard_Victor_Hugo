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
  return null;
}

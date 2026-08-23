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

export function etapeDe(poem: { body?: string | null }, ctx: Contexte): EtapeId {
  if (!poem.body?.trim()) return "preparer";
  if (!ctx.kinds.includes("audio")) return "preparer";
  if (ctx.jobs.some((s) => s === "queued" || s === "running")) return "rendu";
  if (!ctx.kinds.includes("video")) return "rendre";
  if (ctx.pubs.length === 0) return "programmer";
  if (ctx.pubs.some((s) => s !== "published")) return "programme";
  return "publie";
}

// Ce qui manque concrètement, pour l'afficher sur la carte sans faire deviner.
export function manqueDe(poem: { body?: string | null }, ctx: Contexte): string | null {
  if (!poem.body?.trim()) return "texte manquant";
  if (!ctx.kinds.includes("audio")) return "voix manquante";
  return null;
}

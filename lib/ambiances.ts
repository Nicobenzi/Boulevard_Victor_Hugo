// Vocabulaire fermé des ambiances du vivier — figé le 23/08/2026.
//
// Pourquoi fermé : du texte libre ne se filtre pas et ne se retrouve pas trois mois plus tard.
// Dans trois mois on ne saura plus si on avait tapé « sombre », « nuit » ou « nocturne ».
// Neuf mots cochés en deux secondes valent mieux qu'un champ libre jamais relu.
//
// Pourquoi des mots d'ATMOSPHÈRE et non de sujet : le vivier contient des images ET des nappes.
// « mer » ou « forêt » marche pour une image et ne veut rien dire pour une bande son.
//
// Les identifiants sont sans accents (ils servent de clés, se tapent et se comparent mal
// autrement) ; le libellé accentué est pour l'affichage.

export const AMBIANCES = [
  { id: "nuit",       label: "nuit",       aide: "sombre, dense" },
  { id: "braise",     label: "braise",     aide: "chaud, doré, incandescent" },
  { id: "orage",      label: "orage",      aide: "tendu, menaçant" },
  { id: "vertige",    label: "vertige",    aide: "ample, ivre, montant" },
  { id: "melancolie", label: "mélancolie", aide: "lent, retenu" },
  { id: "tendresse",  label: "tendresse",  aide: "doux, clair" },
  { id: "apre",       label: "âpre",       aide: "rude, minéral, sec" },
  { id: "solennel",   label: "solennel",   aide: "grave, ample, cérémonieux" },
  // Le plus utile des neuf : l'étiquette des fonds à grandes zones calmes, ceux où le texte
  // reste lisible. C'est précisément ce qui manquait à `painterly_bg`.
  { id: "vide",       label: "vide",       aide: "calme, presque rien" },
] as const;

export type AmbianceId = (typeof AMBIANCES)[number]["id"];

export const LIBELLE_AMBIANCE: Record<string, string> =
  Object.fromEntries(AMBIANCES.map((a) => [a.id, a.label]));

// Les ambiances vivent dans `assets.meta` (jsonb déjà présent, `NOT NULL DEFAULT '{}'`) :
// aucune migration nécessaire. Vérifié sur le schéma le 23/08.
export function ambiancesDe(asset: { meta?: any }): string[] {
  const v = asset?.meta?.ambiances;
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

// Le méta complet à écrire, en préservant le reste de `meta`.
export function metaAvecAmbiances(meta: any, ambiances: string[]) {
  return { ...(meta ?? {}), ambiances };
}

// Gabarit de caption — déterministe, sans appel réseau ni LLM.
//
// Pourquoi un gabarit et pas un modèle de langage : c'est trois captions par publication
// à écrire à la main (memory.md § 6, à-faire n° 4), et le poste qui sature en premier.
// Un gabarit suffit, coûte 0 €, ne casse pas la règle « tout en client », et donne un
// résultat plus régulier qu'écrit à la volée. La caption reste éditable après génération.

const SIGNATURE = "chaque jour, un poème.";

const TAGS_COMMUNS = ["poesie", "poesiefrancaise", "litterature", "poeme", "lecture"];

const TAGS_PLATEFORME: Record<string, string[]> = {
  instagram: ["poesiedujour", "motsdamour", "citation"],
  tiktok: ["poesietiktok", "booktok", "apprendresurtiktok"],
  youtube: ["shorts", "poesieshorts"],
};

// « Victor Hugo » → « victorhugo ». Les accents sont retirés : un hashtag accentué
// se cherche mal et se tape encore moins bien.
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Premier vers non vide. Le titre est déjà sur la ligne du dessus, on ne le répète pas.
function premierVers(body?: string | null): string {
  return (body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? "";
}

// La caption effective d'une publication.
//
// Depuis le 24/08, la caption est d'abord une propriété du POÈME (`poems.caption`) :
// on l'écrit en lisant le texte, sans avoir à choisir une date au préalable.
// Ce qui est écrit à la main gagne toujours ; le gabarit n'est que le défaut.
// Conséquence assumée : une caption écrite à la main vaut pour les trois plateformes,
// hashtags compris — elle n'est pas complétée par les tags de plateforme, sinon on ne
// saurait plus, en la relisant, ce qui vient de soi et ce qui vient du gabarit.
export function captionPour(
  poem: { title?: string | null; author?: string | null; body?: string | null; caption?: string | null },
  platform: string
): string {
  const ecriteAMain = (poem.caption ?? "").trim();
  return ecriteAMain || genererCaption(poem, platform);
}

export function genererCaption(
  poem: { title?: string | null; author?: string | null; body?: string | null },
  platform: string
): string {
  const titre = (poem.title ?? "").trim();
  const auteur = (poem.author ?? "").trim();
  const vers = premierVers(poem.body);

  const tags = [...TAGS_COMMUNS, ...(TAGS_PLATEFORME[platform] ?? [])];
  if (auteur) tags.push(slug(auteur));

  return [
    auteur ? `« ${titre} » — ${auteur}` : `« ${titre} »`,
    "",
    vers,
    "",
    SIGNATURE,
    "",
    tags.map((t) => `#${t}`).join(" "),
  ]
    .join("\n")
    .trim();
}

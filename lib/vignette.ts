// Fabrique d'aperçus — spec-vivier-visible-2026-08-24, décisions 3 à 5.
//
// Pourquoi une vignette fabriquée et rangée en base plutôt que l'original affiché en petit :
// afficher les fichiers eux-mêmes en `object-fit: cover` sur 76 × 52 ferait, le jour où les
// images arrivent, ~60 Mo par chargement de page contre 5 Go d'egress par mois sur le plan
// Supabase Free — une centaine d'ouvertures et le mois est consommé. Une vignette de ~8 Ko
// voyage avec la ligne : zéro requête de stockage à l'affichage.
//
// Pourquoi dans `meta` : c'est un jsonb `NOT NULL DEFAULT '{}'` déjà présent. Aucune migration,
// et pas de bucket de miniatures à tenir cohérent avec les suppressions (des fichiers orphelins
// garantis, on en a déjà eu).
//
// ⚠ On travaille toujours sur un Blob local (le File du dépôt, ou `storage.download()` pour le
// rattrapage), jamais sur une URL signée : un canvas alimenté depuis une autre origine se
// « tainte » et `toDataURL` lève une SecurityError. Le blob supprime la question.

export const V_LARGEUR = 152;
export const V_HAUTEUR = 104;

const DELAI = 15_000; // au-delà, le fichier est illisible par ce navigateur : on n'insiste pas.

export type Apercu = { vignette?: string; duree?: number };

// Recadrage « cover » centré : on remplit le cadre, on ne déforme jamais.
function dessiner(source: CanvasImageSource, sl: number, sh: number): string {
  const c = document.createElement("canvas");
  c.width = V_LARGEUR;
  c.height = V_HAUTEUR;
  const ctx = c.getContext("2d");
  if (!ctx || !sl || !sh) throw new Error("canvas indisponible");
  const r = Math.max(V_LARGEUR / sl, V_HAUTEUR / sh);
  const l = sl * r;
  const h = sh * r;
  ctx.drawImage(source, (V_LARGEUR - l) / 2, (V_HAUTEUR - h) / 2, l, h);
  return c.toDataURL("image/jpeg", 0.7);
}

function minuteur<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, ko) => setTimeout(() => ko(new Error("délai dépassé")), DELAI)),
  ]);
}

function apercuImage(url: string): Promise<Apercu> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      try { ok({ vignette: dessiner(img, img.naturalWidth, img.naturalHeight) }); }
      catch (e) { ko(e); }
    };
    img.onerror = () => ko(new Error("image illisible"));
    img.src = url;
  });
}

function apercuVideo(url: string): Promise<Apercu> {
  return new Promise((ok, ko) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    let duree: number | undefined;
    v.onloadedmetadata = () => {
      duree = Number.isFinite(v.duration) ? v.duration : undefined;
      // Pas à 0 : la première image d'un plan est très souvent noire.
      v.currentTime = Math.min(0.1, (duree ?? 1) / 10);
    };
    v.onseeked = () => {
      try { ok({ vignette: dessiner(v, v.videoWidth, v.videoHeight), duree }); }
      catch { ok({ duree }); } // la durée seule vaut mieux que rien
    };
    v.onerror = () => ko(new Error("vidéo illisible"));
    v.src = url;
  });
}

function apercuAudio(url: string): Promise<Apercu> {
  return new Promise((ok, ko) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    // Une nappe d'une heure ne se télécharge pas pour connaître sa durée : `metadata` suffit.
    a.onloadedmetadata = () => ok({ duree: Number.isFinite(a.duration) ? a.duration : undefined });
    a.onerror = () => ko(new Error("son illisible"));
    a.src = url;
  });
}

// Une nappe n'a pas de vignette : elle a un aplat et un bouton de lecture. On ne lui fabrique
// qu'une durée.
export async function fabriquerApercu(donnee: Blob, kind: string): Promise<Apercu> {
  const url = URL.createObjectURL(donnee);
  try {
    if (kind === "image") return await minuteur(apercuImage(url));
    if (kind === "broll" || kind === "video") return await minuteur(apercuVideo(url));
    return await minuteur(apercuAudio(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ————— lecture et écriture de `meta` —————
//
// Toujours en fusion : `meta` porte aussi les ambiances, et un remplacement les effacerait.

export function metaAvecApercu(meta: any, a: Apercu) {
  const suivant = { ...(meta ?? {}) };
  if (a.vignette) suivant.vignette = a.vignette;
  if (a.duree) suivant.duree = Math.round(a.duree);
  // Un échec se mémorise, sinon on retente la fabrication à chaque affichage.
  if (!a.vignette && !a.duree) suivant.apercu_echec = true;
  return suivant;
}

export function metaAvecEchec(meta: any) {
  return { ...(meta ?? {}), apercu_echec: true };
}

export const vignetteDe = (a: { meta?: any }): string | null =>
  typeof a?.meta?.vignette === "string" ? a.meta.vignette : null;

export const dureeDe = (a: { meta?: any }): number | null =>
  typeof a?.meta?.duree === "number" ? a.meta.duree : null;

const echecDe = (a: { meta?: any }) => a?.meta?.apercu_echec === true;

// Ce qui manque encore à une ressource. Sert au bouton de rattrapage : le calcul doit être le
// même que celui qui décide d'afficher un aplat, sinon le compteur ment.
export function besoinApercu(a: { kind: string; meta?: any }): boolean {
  if (echecDe(a)) return false;
  if (a.kind === "music" || a.kind === "audio") return dureeDe(a) === null;
  return vignetteDe(a) === null;
}

export function fmtDuree(s?: number | null): string | null {
  if (!s || !Number.isFinite(s)) return null;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

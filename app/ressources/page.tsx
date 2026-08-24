"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, bucketFor } from "@/lib/supabase";
import Vivier, { type Tri } from "@/components/Vivier";
import { fabriquerApercu, metaAvecApercu, metaAvecEchec } from "@/lib/vignette";

// Ressources — spec-vivier-visible-2026-08-24, lots 1 et 2.
//
// La page ne fait que trois choses : dire où on en est du stockage, accueillir le dépôt, et
// monter le vivier. Toute la liste, le classement et la fiche vivent dans `components/Vivier`,
// parce que l'Atelier montera le MÊME composant en mode sélection (lot 3).
//
// Lot 2 — le dépôt refuse AVANT d'envoyer. Le manque n'a jamais été la barre de progression :
// `storage.upload()` n'en donne pas sans réécrire l'envoi en XHR, du code fragile pour un
// fichier de 8 Mo sur fibre. Le vrai manque était qu'un fichier de 214 Mo partait, occupait la
// ligne, et n'échouait qu'à l'arrivée. Un refus doit coûter zéro octet.

const PLAFOND_TOTAL = 1_000_000_000;   // 1 Go, plan Supabase Free — rien ne purge.
const PLAFOND_FICHIER = 50_000_000;    // 50 Mo par fichier, même plan.
const TYPES_OK = ["image/", "audio/", "video/"];

const mo = (n: number) => (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + " Mo";

// Le type se déduit du fichier. Une vidéo est un métrage par défaut : c'est le cas le plus
// fréquent, et le reclassement est à un clic dans la fiche.
function kindFor(f: File) {
  if (f.type.startsWith("video/")) return "broll";
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("audio/")) return "music";
  return "image";
}

type Etat = "attente" | "envoi" | "ok" | "refusé" | "erreur";
type Item = { file: File; etat: Etat; msg?: string };

// Le contrôle pré-vol. Trois motifs, trois messages qui disent la valeur ET la limite —
// « erreur » tout seul oblige à deviner, et on redépose le même fichier.
function refusDe(f: File, resteDisponible: number): string | null {
  if (!TYPES_OK.some((t) => f.type.startsWith(t))) {
    const ext = (f.name.split(".").pop() ?? "").toUpperCase();
    return `${ext ? `les ${ext}` : "ce type de fichier"} ne sont pas de la matière : ni image, ni son, ni vidéo.`;
  }
  if (f.size > PLAFOND_FICHIER) {
    return `${mo(f.size)}, la limite est de 50 Mo par fichier. Réencode-le ou coupe-le avant.`;
  }
  if (f.size > resteDisponible) {
    return `${mo(f.size)}, et il ne reste que ${mo(resteDisponible)} sur le 1 Go. Fais de la place d'abord.`;
  }
  return null;
}

export default function Ressources() {
  const [total, setTotal] = useState(0);
  const [nb, setNb] = useState(0);
  const [queue, setQueue] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rafraichir, setRafraichir] = useState(0);
  const [tri, setTri] = useState<Tri>("recent");

  // Requête volontairement maigre : la page n'a besoin que du quota. Les vignettes pèsent ~8 Ko
  // par ligne et n'ont rien à faire ici — c'est le vivier qui les charge.
  const quota = useCallback(async () => {
    const { data, error } = await supabase.from("assets").select("size_bytes");
    if (error) { setErr(error.message); return; }
    setTotal((data ?? []).reduce((s: number, a: any) => s + (a.size_bytes ?? 0), 0));
    setNb((data ?? []).length);
  }, []);
  useEffect(() => { quota(); }, [quota, rafraichir]);

  const reste = Math.max(0, PLAFOND_TOTAL - total);
  const part = Math.min(100, Math.round((total / PLAFOND_TOTAL) * 100));
  const haut = part >= 90;

  // Les totaux se dérivent de la file : un seul état à tenir, jamais deux qui divergent.
  const aEnvoyer = queue.filter((x) => x.etat !== "refusé");
  const envoyes = queue.filter((x) => x.etat === "ok");
  const refuses = queue.filter((x) => x.etat === "refusé").length;
  const poidsPrevu = aEnvoyer.reduce((s, x) => s + x.file.size, 0);
  const poidsFait = envoyes.reduce((s, x) => s + x.file.size, 0);

  const maj = (i: number, x: Partial<Item>) =>
    setQueue((q) => q.map((y, j) => (j === i ? { ...y, ...x } : y)));

  async function envoyer(i: number, file: File) {
    maj(i, { etat: "envoi", msg: undefined });
    const k = kindFor(file);
    const bucket = k === "music" ? "audios" : bucketFor(file.type);
    const path = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      // Rien n'a été écrit en base : le fichier n'existe ni au stockage ni dans le vivier.
      maj(i, { etat: "erreur", msg: `l'envoi a échoué (${error.message}). Rien n'a été enregistré.` });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: ins, error: e2 } = await supabase.from("assets").insert({
      poem_id: null, kind: k, title: file.name, storage_bucket: bucket, storage_path: path,
      mime_type: file.type, size_bytes: file.size, created_by: user?.id,
    }).select("id, meta").single();

    if (e2 || !ins) {
      // Le fichier est au stockage mais pas en base : on le retire, sinon il consomme le quota
      // sans plus apparaître nulle part. Même raisonnement que pour la suppression.
      await supabase.storage.from(bucket).remove([path]);
      maj(i, { etat: "erreur", msg: `${e2?.message ?? "enregistrement impossible"} — le fichier a été retiré du stockage.` });
      return;
    }

    // L'aperçu se fabrique ICI, sur le fichier qu'on a déjà en main : pas de re-téléchargement,
    // pas de canvas « tainté » par une autre origine, et plus jamais de requête de stockage pour
    // afficher la liste.
    try {
      const apercu = await fabriquerApercu(file, k);
      await supabase.from("assets").update({ meta: metaAvecApercu(ins.meta, apercu) }).eq("id", ins.id);
    } catch {
      await supabase.from("assets").update({ meta: metaAvecEchec(ins.meta) }).eq("id", ins.id);
    }
    maj(i, { etat: "ok" });
  }

  async function deposer(files: File[]) {
    if (!files.length) return;
    setErr(null);

    // Pré-vol d'abord, sur toute la brassée. Le quota se décompte au fur et à mesure : trois
    // fichiers de 400 Mo ne peuvent pas tous « tenir dans ce qui reste ».
    let dispo = reste;
    const items: Item[] = files.map((file) => {
      const r = refusDe(file, dispo);
      if (!r) dispo -= file.size;
      return { file, etat: r ? "refusé" : "attente", msg: r ?? undefined };
    });
    setQueue(items);

    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      if (items[i].etat === "refusé") continue;
      await envoyer(i, items[i].file);
    }
    setBusy(false);
    setRafraichir((n) => n + 1);

    // La file ne s'efface toute seule que si elle n'a rien à raconter. Un refus ou un échec
    // reste à l'écran jusqu'à ce qu'on l'ait lu.
    setTimeout(() => setQueue((q) => (q.every((x) => x.etat === "ok") ? [] : q)), 4000);
  }

  async function reessayer(i: number) {
    setBusy(true);
    await envoyer(i, queue[i].file);
    setBusy(false);
    setRafraichir((n) => n + 1);
  }

  const champFichier = (
    <label className="btn text-xs cursor-pointer">
      {busy ? "envoi…" : "+ Déposer"}
      <input type="file" multiple disabled={busy} accept="image/*,audio/*,video/*" style={{ display: "none" }}
        onChange={(e) => { deposer(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }} />
    </label>
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); deposer(Array.from(e.dataTransfer.files)); }}
    >
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="font-serif2 text-3xl">Ressources</h1>
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {nb} fichier{nb > 1 ? "s" : ""} · 50 Mo maximum par fichier
        </span>
        <span className="ml-auto">{champFichier}</span>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-dim)" }}>
        Dépose, puis classe. La voix d&apos;un poème se dépose sur sa fiche, dans l&apos;Atelier.
      </p>

      {/* La jauge dit ce qui RESTE, pas seulement ce qui est pris : c'est la seule des deux
          informations sur laquelle on peut agir. Rien ne purge automatiquement. */}
      {nb > 0 && (
        <div className="card mb-4" style={{ padding: 12 }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="label">Stockage</span>
            <span className="text-sm">{mo(total)} sur 1 Go</span>
            <span className="text-xs ml-auto" style={{ color: haut ? "var(--danger)" : "var(--ink-dim)" }}>
              {mo(reste)} restants
              {reste < PLAFOND_FICHIER ? " — plus assez pour un fichier de 50 Mo." : ""}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--bg)", border: "1px solid var(--line)", marginTop: 8 }}>
            <div style={{ width: `${part}%`, height: "100%", borderRadius: 999, background: haut ? "var(--danger)" : "var(--encre)" }} />
          </div>
          {haut && (
            <div className="text-xs mt-2 flex gap-2 items-center flex-wrap" style={{ color: "var(--ink-dim)" }}>
              Rien ne purge automatiquement. Pour faire de la place, supprime des métrages déjà montés.
              <button className="facette" onClick={() => setTri("poids")}>trier par poids</button>
            </div>
          )}
        </div>
      )}

      {err && <div className="card mb-3" role="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{err}</div>}

      {/* La file. Un total et un compte, pas une barre par fichier : la progression avance par
          fichier terminé, ce qui est honnête et ne demande pas de réécrire l'envoi. */}
      {queue.length > 0 && (
        <div className="card mb-4 grid gap-2" aria-live="polite">
          <div className="flex gap-3 items-baseline flex-wrap text-sm">
            <strong>{envoyes.length} sur {aEnvoyer.length} envoyé{envoyes.length > 1 ? "s" : ""}</strong>
            <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{mo(poidsFait)} sur {mo(poidsPrevu)}</span>
            {refuses > 0 && (
              <span className="text-xs" style={{ color: "var(--danger)" }}>
                {refuses} refusé{refuses > 1 ? "s" : ""}, rien n&apos;a été envoyé pour {refuses > 1 ? "eux" : "lui"}
              </span>
            )}
          </div>

          {queue.map((it, i) => (
            <div key={i} className="grid gap-1 text-xs" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
              <div className="flex gap-3 items-baseline flex-wrap">
                <span style={{
                  width: 78, flexShrink: 0,
                  color: it.etat === "ok" ? "var(--encre)"
                    : it.etat === "erreur" || it.etat === "refusé" ? "var(--danger)" : "var(--ink-dim)",
                }}>
                  {it.etat === "ok" ? "envoyé ✓" : it.etat === "envoi" ? "envoi…" : it.etat === "attente" ? "en attente" : it.etat}
                </span>
                <span className="truncate" style={{ flex: "1 1 160px", minWidth: 0 }}>{it.file.name}</span>
                <span style={{ color: "var(--ink-dim)" }}>{mo(it.file.size)}</span>
                {it.etat === "erreur" && (
                  <button className="facette" disabled={busy} onClick={() => reessayer(i)}>réessayer</button>
                )}
              </div>
              {it.msg && <div role="alert" style={{ color: "var(--danger)" }}>{it.msg}</div>}
            </div>
          ))}

          {/* Les limites se rappellent en bas de la file : c'est là qu'on revient après un refus. */}
          <div className="text-xs" style={{ color: "var(--ink-dim)", borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            50 Mo maximum par fichier · {mo(reste)} restants sur 1 Go
          </div>
        </div>
      )}

      {/* Vide : rien à filtrer, donc pas de barre. Les limites sont dites avant le premier geste. */}
      {nb === 0 && queue.length === 0 ? (
        <div className="card text-center" style={{ borderStyle: "dashed", padding: 48 }}>
          <p className="font-serif2 text-2xl mb-2">
            Glisse ici tes métrages,<br />tes images et tes nappes
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-dim)" }}>
            Le type est deviné du fichier. Rien ne t&apos;est demandé au dépôt — on classe après.
            50 Mo maximum par fichier, 1 Go en tout.
          </p>
          <div className="flex justify-center">{champFichier}</div>
          <p className="text-xs mt-4" style={{ color: "var(--ink-dim)" }}>
            La voix d&apos;un poème ne se dépose pas ici, mais sur sa fiche, dans l&apos;Atelier.
          </p>
        </div>
      ) : (
        <Vivier mode="gestion" rafraichir={rafraichir} tri={tri} onTri={setTri} />
      )}

      {over && (
        <div className="mt-3 rounded-xl text-center font-serif2 text-xl"
          style={{ border: "1px dashed var(--encre)", padding: 24, color: "var(--encre)" }}>
          Lâche pour déposer
        </div>
      )}
    </div>
  );
}

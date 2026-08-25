# Ouvrir les comptes — Instagram, TikTok, YouTube

- Date : 2026-08-24 — **pseudos réécrits le 2026-08-25**, le projet s'appelle désormais *Novalis*.
- Décidé avec Nicolas : les trois plateformes, une adresse mail dédiée au projet, profil Créateur.
- ⚠ Aucun compte n'était ouvert au moment du changement de nom : rien à migrer, tout est à créer
  directement sous le nouveau nom.

> ⚠ **Ce dépôt est PUBLIC.** Aucun mot de passe, aucun jeton, aucune adresse de récupération ne
> doit apparaître ici ni dans aucun fichier du dossier. Les identifiants vont dans un
> gestionnaire de mots de passe partagé entre Nicolas et Charley — pas dans un fichier, pas dans
> un message, pas dans `memory.md`.

---

## 1. L'adresse mail, d'abord

Tout part de là : c'est elle qui récupère les trois comptes si l'un se perd, et elle ne doit
dépendre ni de la boîte de Nicolas ni de celle de Charley.

- Créer une adresse dédiée (Gmail, Proton, peu importe) au nom du projet.
- **Activer la double authentification dessus**, et ranger les codes de secours dans le
  gestionnaire de mots de passe. Une adresse qui commande trois comptes sans second facteur est
  le point de rupture de tout l'édifice.
- Y donner accès à Charley. C'est le sens du choix « adresse dédiée » : que ni l'un ni l'autre
  ne soit un point de passage obligé.

## 2. Le pseudo — le même partout

**Premier choix : `novalis`** (7 caractères, large sur les trois : Instagram autorise 30,
TikTok 24, YouTube 30).

⚠ **Il sera très probablement pris.** Novalis est le nom de plume d'un poète romantique allemand
connu, et un pseudo de sept lettres sur des plateformes ouvertes depuis dix ans a peu de chances
d'être libre. Vérifier, mais partir du principe qu'on ira sur un repli — et **prendre le même sur
les trois**, quitte à renoncer au premier choix sur une plateforme où il est libre. Un compte
qu'on ne retrouve pas sous le même nom d'une application à l'autre perd la moitié de son intérêt.

Dans cet ordre :

1. `novalis.poemes`
2. `novalis.studio`
3. `studionovalis`

**Nom affiché**, partout : `Novalis`.

## 3. Instagram

1. Créer le compte avec l'adresse dédiée.
2. **Passer en Créateur** : Paramètres → Type de compte → Basculer vers un compte professionnel
   → Créateur. Catégorie suggérée : **Écrivain·e** ou **Artiste**.
3. **Créer une Page Facebook liée**, même vide, même sans jamais y publier.
   Elle ne sert à rien aujourd'hui — mais c'est le **prérequis de l'API de publication**, et la
   rattacher après coup sur un compte déjà vivant est nettement plus pénible que maintenant.
   Coût aujourd'hui : cinq minutes. Coût plus tard : une soirée.
4. Le compte reste **public**.

**Bio** (150 caractères maximum) :

```
Des poèmes du domaine public, lus à voix haute.
Baudelaire, Heredia, Rimbaud, Verlaine.
Chaque jour, un poème.
```

## 4. TikTok

1. Créer le compte avec la même adresse.
2. Compte **public**, pseudo identique.
3. Ne pas activer de compte professionnel : ça n'apporte rien ici et complique l'affichage.

**Bio** (80 caractères maximum) :

```
Poèmes du domaine public, lus à voix haute.
Chaque jour, un poème.
```

⚠ **Le piège à connaître**, si l'automatisation revient sur la table un jour : l'API de
publication de TikTok exige, tant que le client n'est pas audité, que le compte soit **privé au
moment de poster**. Autrement dit l'automatisation y est inutilisable pour un compte public.
**Sur TikTok, on publiera à la main. Prévoyez-le dès maintenant.**

## 5. YouTube

1. Se connecter avec l'adresse dédiée, créer une **chaîne** (pas un simple compte Google).
2. Handle `@novalis` (ou le repli retenu au § 2), nom `Novalis`.
3. Les vidéos verticales de moins de 3 min deviennent des **Shorts** automatiquement — aucun
   réglage à faire, il suffit de téléverser le fichier tel quel.

**Description de la chaîne** (1 000 caractères maximum) :

```
Des poèmes du domaine public, lus à voix haute et mis en images.

Baudelaire, Heredia, Rimbaud, Verlaine, Hugo — les textes sont
collationnés sur les éditions de référence, la musique est composée
pour chaque vidéo, et rien n'est emprunté à personne.

Chaque jour, un poème.
```

⚠ Même remarque que TikTok : un téléversement par l'API depuis un projet non audité est
**verrouillé en privé, sans appel possible**. Sur YouTube aussi, on publie à la main.

## 6. Ce qu'il faut faire tout de suite après

- Ranger les trois identifiants dans le gestionnaire de mots de passe partagé.
- Activer la double authentification **sur les trois comptes**, pas seulement sur le mail.
- Publier *Les Conquérants* et *l'Hymne à la Beauté*, qui sont montés et n'attendent que ça.
  Trois comptes vides sont un passif ; le pseudo n'est réservé pour de bon que par l'usage.
- Reporter les URL publiées dans `publications.published_url` depuis l'Atelier — c'est le seul
  lien entre l'app et le monde réel, et il existe déjà.

## 7. Ce qu'il ne faut PAS faire

- **Ouvrir les comptes et attendre.** Le compte le plus dur à faire vivre est celui qui a trois
  semaines et zéro publication.
- **Écrire les mots de passe dans le dépôt.** Il est public, et l'historique git ne s'efface pas.
- **Automatiser la publication maintenant.** Décision du 24/08 (memory.md § 4) : seule Instagram
  serait techniquement faisable, et automatiser un geste qu'on n'a pas encore fait une seule fois
  est exactement ce que ce projet s'interdit.

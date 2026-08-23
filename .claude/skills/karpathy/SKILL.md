---
name: karpathy
description: Principes de code dans l'esprit d'Andrej Karpathy, adaptés à ce repo. À charger avant d'écrire ou de refactorer du code — quand l'utilisateur dit "code ça proprement", "refactor", "ajoute une feature", "simplifie", ou quand une PR/un diff s'annonce plus gros que nécessaire.
---

# Coder dans l'esprit Karpathy

Ce projet est maintenu par une personne, sur son temps libre. Chaque ligne de code est une dette.
Le meilleur code est celui qu'on n'écrit pas.

## Principes

1. **Supprimer > ajouter.** Une PR qui retire des lignes vaut plus qu'une PR qui en ajoute.
   Avant d'écrire, demande-toi : peut-on résoudre ça en enlevant quelque chose ?

2. **Pas d'abstraction prématurée.** Deux occurrences similaires = on duplique. Trois occurrences
   ET une vraie raison = on factorise peut-être. Jamais de helper "au cas où", jamais de
   généralisation pour un besoin hypothétique.

3. **Code qu'on tient dans sa tête.** Une fonction se lit de haut en bas, sans sauter entre
   5 fichiers. Préfère 40 lignes lisibles au même endroit à 15 lignes réparties dans 3 modules.

4. **Dépendances : non par défaut.** Chaque package npm/pip est un risque (breaking changes,
   supply chain, poids). 30 lignes de code maison valent mieux qu'une dépendance de 2 Mo.
   Toute nouvelle dépendance doit être défendue explicitement.

5. **Explicite > malin.** Pas de métaprogrammation, pas de clever one-liners, pas d'indirection
   par configuration. Le code doit être ennuyeux à lire.

6. **Le chemin heureux d'abord.** Écris le flux nominal simplement ; gère les erreurs réelles
   (celles qu'on a vues ou qu'on provoquera), pas toutes les erreurs imaginables.

7. **Petits diffs.** Un changement = une intention. Pas de refactor opportuniste glissé dans
   une feature. Si tu vois du code à améliorer en passant, note-le dans memory.md.

8. **État minimal.** Chaque useState, chaque table, chaque champ doit justifier son existence.
   La donnée dérivable se calcule, elle ne se stocke pas.

## Application à ce repo

- Client components simples + supabase-js direct : ne pas introduire de couche d'abstraction
  (pas de "services", pas de "repositories", pas de state manager).
- pipeline/render.py reste UN fichier séquentiel lisible de haut en bas.
- Si une page dépasse ~250 lignes, c'est le signal de découper — pas avant.

## Avant de conclure une session de code

- Peut-on retirer quelque chose que ce changement a rendu inutile ?
- Le diff est-il compréhensible par Nicolas dans 6 mois, sans contexte ?
- `npm run build` passe ?

import { redirect } from "next/navigation";
// Fusionné dans /publications (vue liste). Conservé pour les favoris et l'historique.
export default function Publier() { redirect("/publications"); }

import { redirect } from "next/navigation";
// Fusionné dans /publications (vue calendrier). Conservé pour les favoris et l'historique.
export default function Calendrier() { redirect("/publications"); }

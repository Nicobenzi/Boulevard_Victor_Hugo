import { redirect } from "next/navigation";
// Renommée en /ressources. Conservé pour les favoris et l'historique.
export default function Bibliotheque() { redirect("/ressources"); }

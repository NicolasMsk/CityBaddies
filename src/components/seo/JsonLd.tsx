// Balise JSON-LD NATIVE rendue côté serveur.
//
// ⚠️ Ne PAS remplacer par next/script : next/script injecte le script APRÈS
// hydratation côté client → le JSON-LD est absent du HTML initial et donc
// invisible pour les crawlers qui n'exécutent pas le JS (GPTBot, ClaudeBot,
// PerplexityBot) et pour la 1ère vague d'indexation Google.
// Une balise <script> native dans un Server Component est, elle, présente
// dans le HTML servi.
export default function JsonLd({ data, id }: { data: unknown; id?: string }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // JSON.stringify échappe déjà les guillemets ; on neutralise "</script>"
      // pour éviter toute injection via un champ texte (description produit…).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

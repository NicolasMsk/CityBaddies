import DOMPurify from 'isomorphic-dompurify';

/**
 * Nettoie un fragment HTML avant `dangerouslySetInnerHTML`.
 *
 * Pourquoi : les champs HTML (whyGoodDeal, guide.introduction, pages promo…)
 * sont générés par IA à partir de descriptions SCRAPÉES de sites tiers. Une
 * injection dans le contenu source ("… <img src=x onerror=…>") pourrait
 * produire du HTML malveillant, stocké puis rendu à toutes les visiteuses.
 * On limite le rendu à des balises de mise en forme simples, sans attributs
 * exécutables ni URL douteuses.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'span', 'h2', 'h3', 'h4', 'a', 'blockquote'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i, // pas de javascript:/data:
  });
}

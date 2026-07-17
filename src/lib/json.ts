/**
 * Cast sûr d'un champ Json Prisma vers un tableau.
 *
 * Les champs `faq`, `howToUse`, `tips`… sont du `Json?` alimenté par IA.
 * Un `as T[]` non validé crashe la page (500) si l'IA renvoie une string
 * (`.length` truthy puis `.map is not a function`) ou un objet. Ce guard
 * renvoie [] pour toute valeur non-tableau.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

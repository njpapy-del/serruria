// Outils texte du Lead Radar : comparaison insensible aux accents et à la casse.

/** "Créteil — Porte CLAQUÉE !" -> "creteil porte claquee" */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vrai si l'une des expressions (déjà normalisées) apparaît comme suite de mots entiers. */
export function containsAny(normalizedText: string, phrases: readonly string[]): string[] {
  const padded = ` ${normalizedText} `;
  return phrases.filter((p) => padded.includes(` ${p} `));
}

/** Retire les balises HTML et décode les entités courantes (contenu RSS). */
export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Empreinte stable et courte (FNV-1a 32 bits) — sert à la déduplication, pas à la sécurité. */
export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

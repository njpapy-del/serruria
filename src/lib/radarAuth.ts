import { timingSafeEqual } from "node:crypto";

/** Jeton du robot (en-tête Authorization: Bearer …), comparé en temps constant. */
export function isValidIngestToken(header: string | null): boolean {
  const expected = process.env.RADAR_INGEST_TOKEN ?? "";
  if (expected.length < 32 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

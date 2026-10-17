// Contrôle d'accès : chaque méthode HTTP d'une route /api/admin (hors connexion/déconnexion)
// doit vérifier la session administrateur. Échoue si une nouvelle route l'oublie.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src", "app", "api", "admin");
const PUBLIC = new Set(["login", "logout"]);

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? routes(p) : f === "route.ts" ? [p] : [];
  });
}

describe("routes d'administration", () => {
  const files = routes(ROOT).filter((f) => !PUBLIC.has(path.basename(path.dirname(f))));
  it.each(files.map((f) => [path.relative(ROOT, f), f]))("%s : chaque méthode vérifie la session", (_, file) => {
    const src = readFileSync(file, "utf8");
    const methods = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
    const guards = src.match(/if \(!\(await isAdminAuthenticated\(\)\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)|if \(!\(await isAdminAuthenticated\(\)\)\) \{\s*return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/g) ?? [];
    expect(methods.length).toBeGreaterThan(0);
    expect(guards.length).toBe(methods.length);
  });
});

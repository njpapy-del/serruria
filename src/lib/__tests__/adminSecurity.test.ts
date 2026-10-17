import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, isValidSessionToken } from "../adminAuth";
import { _resetMemory, isBlocked, MAX_FAILURES, recordFailure, WINDOW_MS } from "../loginRateLimit";

describe("session administrateur", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "secret-de-test";
  });
  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it("accepte un jeton valide et refuse un jeton modifié, tronqué ou expiré", () => {
    const token = createSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
    const [payload, sig] = token.split(".");
    expect(isValidSessionToken(`${payload}.${sig.slice(0, -1)}0`)).toBe(false);
    expect(isValidSessionToken(`${payload}.${sig.slice(0, 10)}`)).toBe(false);
    expect(isValidSessionToken(`${Number(payload) + 1000}.${sig}`)).toBe(false);
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken("pasunjeton")).toBe(false);
  });

  it("changer ADMIN_SESSION_SECRET révoque toutes les sessions", () => {
    const token = createSessionToken();
    process.env.ADMIN_SESSION_SECRET = "nouveau-secret";
    expect(isValidSessionToken(token)).toBe(false);
  });
});

describe("limite des tentatives de connexion", () => {
  beforeEach(() => _resetMemory());

  it(`bloque après ${MAX_FAILURES} échecs puis débloque après 15 min`, async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure("1.2.3.4", null, t0);
    expect(await isBlocked("1.2.3.4", null, t0)).toBe(false);
    await recordFailure("1.2.3.4", null, t0);
    expect(await isBlocked("1.2.3.4", null, t0)).toBe(true);
    expect(await isBlocked("5.6.7.8", null, t0)).toBe(false); // autre adresse
    expect(await isBlocked("1.2.3.4", null, t0 + WINDOW_MS + 1)).toBe(false);
  });

  it("se replie sur la mémoire si la table n'existe pas encore", async () => {
    const brokenSql = async () => {
      throw new Error('relation "admin_login_attempts" does not exist');
    };
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure("9.9.9.9", brokenSql);
    expect(await isBlocked("9.9.9.9", brokenSql)).toBe(true);
  });
});

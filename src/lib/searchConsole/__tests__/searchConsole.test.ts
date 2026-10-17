// Tests Search Console — aucun appel à Google : clé générée pour le test et fetch simulé.
import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { accessToken, parseServiceAccount, searchAnalytics, signedJwt, SearchConsoleError } from "../client";
import { buildReport, fetchReport, reportWindow } from "../report";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = {
  client_email: "lead-radar@projet-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("authentification par compte de service", () => {
  it("signe un JWT RS256 vérifiable, en lecture seule", () => {
    const jwt = signedJwt(sa, 1_800_000_000);
    const [h, c, sig] = jwt.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64").toString());
    expect(claims.scope).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("accepte le compte de service en JSON ou en base64 et refuse une config incomplète", () => {
    expect(parseServiceAccount(JSON.stringify(sa)).client_email).toBe(sa.client_email);
    expect(parseServiceAccount(Buffer.from(JSON.stringify(sa)).toString("base64")).client_email).toBe(sa.client_email);
    expect(() => parseServiceAccount(undefined)).toThrow(SearchConsoleError);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(SearchConsoleError);
  });

  it("type les erreurs (accès refusé, quota)", async () => {
    await expect(accessToken(sa, (async () => jsonResponse(401, {})) as typeof fetch)).rejects.toMatchObject({ code: "auth" });
    await expect(searchAnalytics("t", "sc-domain:x.fr", { startDate: "a", endDate: "b", dimensions: ["query"] }, (async () => jsonResponse(403, {})) as typeof fetch)).rejects.toMatchObject({ code: "permission" });
    await expect(searchAnalytics("t", "sc-domain:x.fr", { startDate: "a", endDate: "b", dimensions: ["query"] }, (async () => jsonResponse(429, {})) as typeof fetch)).rejects.toMatchObject({ code: "quota" });
  });
});

describe("rapport", () => {
  it("fenêtre de 28 jours se terminant 3 jours avant (délai des données)", () => {
    expect(reportWindow(new Date("2026-10-17T08:00:00Z"))).toEqual({ startDate: "2026-09-17", endDate: "2026-10-14" });
  });

  it("calcule les totaux et repère les opportunités de serrurerie", () => {
    const rows = [
      { keys: ["serrurier aubervilliers"], clicks: 2, impressions: 120, ctr: 2 / 120, position: 14.2 },
      { keys: ["porte claquée paris"], clicks: 0, impressions: 60, ctr: 0, position: 6.1 },
      { keys: ["serrurerie louis et fils"], clicks: 10, impressions: 15, ctr: 0.66, position: 1 },
      { keys: ["recette crêpes"], clicks: 0, impressions: 40, ctr: 0, position: 30 },
    ];
    const r = buildReport("sc-domain:serrurerielouisfils.com", { startDate: "a", endDate: "b" }, rows, []);
    expect(r.totaux.clics).toBe(12);
    expect(r.totaux.impressions).toBe(235);
    expect(r.opportunites.map((o) => o.requete)).toEqual(["serrurier aubervilliers", "porte claquée paris"]);
    expect(r.requetes[0].requete).toBe("serrurier aubervilliers");
  });

  it("enchaîne jeton + deux requêtes (requêtes, pages) filtrées sur la France", async () => {
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      if (url.includes("oauth2")) return jsonResponse(200, { access_token: "tok" });
      return jsonResponse(200, { rows: [{ keys: ["serrurier paris"], clicks: 1, impressions: 50, ctr: 0.02, position: 9 }] });
    }) as unknown as typeof fetch;
    const r = await fetchReport(sa, "sc-domain:serrurerielouisfils.com", new Date("2026-10-17T08:00:00Z"), fake);
    expect(calls).toHaveLength(3);
    expect(calls[1].url).toContain(encodeURIComponent("sc-domain:serrurerielouisfils.com"));
    expect(JSON.parse(calls[1].body).dimensionFilterGroups[0].filters[0].expression).toBe("fra");
    expect(r.requetes[0].requete).toBe("serrurier paris");
  });
});

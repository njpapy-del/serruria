import { afterEach, describe, expect, it } from "vitest";
import { isValidIngestToken } from "../radarAuth";

const TOKEN = "a".repeat(40);

describe("jeton du robot", () => {
  afterEach(() => {
    delete process.env.RADAR_INGEST_TOKEN;
  });
  it("accepte uniquement le bon jeton Bearer", () => {
    process.env.RADAR_INGEST_TOKEN = TOKEN;
    expect(isValidIngestToken(`Bearer ${TOKEN}`)).toBe(true);
    expect(isValidIngestToken(`Bearer ${"b".repeat(40)}`)).toBe(false);
    expect(isValidIngestToken(TOKEN)).toBe(false);
    expect(isValidIngestToken(null)).toBe(false);
  });
  it("refuse tout si le jeton serveur est absent ou trop court", () => {
    expect(isValidIngestToken("Bearer ")).toBe(false);
    process.env.RADAR_INGEST_TOKEN = "court";
    expect(isValidIngestToken("Bearer court")).toBe(false);
  });
});

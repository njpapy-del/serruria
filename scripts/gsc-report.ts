// Rapport Search Console en JSON sur la sortie standard (appelé par l'agent).
// Variables : GSC_SERVICE_ACCOUNT_JSON (JSON ou base64), GSC_PROPERTY
// (ex. « sc-domain:serrurerielouisfils.com » ou « https://serrurerielouisfils.com/»).
import { parseServiceAccount, SearchConsoleError } from "@/lib/searchConsole/client";
import { fetchReport } from "@/lib/searchConsole/report";

async function main() {
  const property = process.env.GSC_PROPERTY;
  if (!property) throw new SearchConsoleError("GSC_PROPERTY absente", "config");
  const sa = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON);
  process.stdout.write(JSON.stringify(await fetchReport(sa, property, new Date())));
}

main().catch((error) => {
  const code = error instanceof SearchConsoleError ? error.code : "http";
  process.stderr.write(JSON.stringify({ error: code, message: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exit(code === "config" ? 2 : 1);
});

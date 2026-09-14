// Lit/écrit des fichiers du dépôt GitHub via l'API Contents — c'est le
// "stockage" utilisé par l'espace admin (pas de base de données ni de
// service cloud supplémentaire : chaque modification devient un commit,
// Vercel redéploie automatiquement).

const API_BASE = "https://api.github.com";

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  if (!token || !repo) {
    throw new Error("GITHUB_TOKEN / GITHUB_REPO manquants");
  }
  return { token, repo, branch };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function getFile(path: string): Promise<{ content: string; sha: string } | null> {
  const { token, repo, branch } = getConfig();
  const res = await fetch(
    `${API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`,
    { headers: headers(token), cache: "no-store" }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile ${path} a échoué : ${res.status}`);

  const data = await res.json();
  return {
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    sha: data.sha,
  };
}

export async function putFile(
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const { token, repo, branch } = getConfig();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub putFile ${path} a échoué : ${res.status} ${body}`);
  }
}

export async function putBinaryFile(
  path: string,
  base64Content: string,
  message: string
): Promise<void> {
  const { token, repo, branch } = getConfig();
  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: base64Content, branch }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub putBinaryFile ${path} a échoué : ${res.status} ${body}`);
  }
}

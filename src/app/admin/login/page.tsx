"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 card-elevated"
      >
        <h1 className="text-xl font-bold text-navy-900">Espace admin</h1>
        <p className="mt-1 text-sm text-slate-500">Connectez-vous pour modifier le site.</p>

        <label htmlFor="password" className="mt-6 block text-sm font-semibold text-navy-800">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-amber-400 focus:outline-none"
        />

        {error ? (
          <p className="mt-3 text-sm text-red-600">Mot de passe incorrect.</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-amber-500 py-3 font-bold text-navy-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

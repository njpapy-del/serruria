"use client";

type Status = "idle" | "saving" | "saved" | "error";

export function SaveButton({ status, onClick }: { status: Status; onClick: () => void }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={status === "saving"}
        className="rounded-full bg-amber-500 px-5 py-2 text-sm font-bold text-navy-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
      >
        {status === "saving" ? "Enregistrement…" : "Enregistrer"}
      </button>
      {status === "saved" ? (
        <span className="text-sm font-semibold text-success-500">
          Enregistré — en ligne dans ~1 min.
        </span>
      ) : null}
      {status === "error" ? (
        <span className="text-sm font-semibold text-red-600">Échec de l&apos;enregistrement.</span>
      ) : null}
    </div>
  );
}

export async function saveSection(section: string, value: unknown): Promise<boolean> {
  const res = await fetch("/api/admin/save-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, value }),
  });
  return res.ok;
}

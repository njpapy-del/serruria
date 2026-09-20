"use client";

import { useState } from "react";
import { SaveButton, saveSection } from "@/components/admin/SaveButton";

export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-navy-800">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      )}
    </label>
  );
}

export function Block({
  title,
  section,
  value,
  onSaved,
  children,
}: {
  title: string;
  section: string;
  value: unknown;
  onSaved?: () => void;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    const ok = await saveSection(section, value);
    setStatus(ok ? "saved" : "error");
    if (ok) onSaved?.();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <h3 className="font-bold text-navy-900">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
      <SaveButton status={status} onClick={handleSave} />
    </div>
  );
}

type Content = {
  brand: { slogan: string; positioning: string };
  hero: { badge: string; title: string; subtitle: string };
  promo: { text: string; tag: string };
  trustBullets: string[];
  etapes: { numero: string; titre: string; description: string }[];
  services: { id: string; label: string; description: string }[];
  confiance: { label: string; description: string }[];
  faq: { question: string; reponse: string }[];
};

export function TextEditor({ initial }: { initial: Content }) {
  const [content, setContent] = useState(initial);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-navy-900">Textes du site</h2>

      <Block title="Accroche (hero)" section="hero" value={content.hero}>
        <Field
          label="Badge"
          value={content.hero.badge}
          onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, badge: v } }))}
        />
        <Field
          label="Titre"
          value={content.hero.title}
          onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, title: v } }))}
        />
        <Field
          label="Sous-titre"
          multiline
          value={content.hero.subtitle}
          onChange={(v) => setContent((c) => ({ ...c, hero: { ...c.hero, subtitle: v } }))}
        />
      </Block>

      <Block title="Bandeau promo" section="promo" value={content.promo}>
        <Field
          label="Texte"
          value={content.promo.text}
          onChange={(v) => setContent((c) => ({ ...c, promo: { ...c.promo, text: v } }))}
        />
        <Field
          label="Étiquette"
          value={content.promo.tag}
          onChange={(v) => setContent((c) => ({ ...c, promo: { ...c.promo, tag: v } }))}
        />
      </Block>

      <Block title="Slogan & positionnement" section="brand" value={content.brand}>
        <Field
          label="Slogan"
          value={content.brand.slogan}
          onChange={(v) => setContent((c) => ({ ...c, brand: { ...c.brand, slogan: v } }))}
        />
        <Field
          label="Positionnement"
          value={content.brand.positioning}
          onChange={(v) => setContent((c) => ({ ...c, brand: { ...c.brand, positioning: v } }))}
        />
      </Block>

      <Block title="Points de confiance (hero)" section="trustBullets" value={content.trustBullets}>
        {content.trustBullets.map((bullet, i) => (
          <Field
            key={i}
            label={`Point ${i + 1}`}
            value={bullet}
            onChange={(v) =>
              setContent((c) => ({
                ...c,
                trustBullets: c.trustBullets.map((b, idx) => (idx === i ? v : b)),
              }))
            }
          />
        ))}
      </Block>

      <Block title="Comment ça marche (4 étapes)" section="etapes" value={content.etapes}>
        {content.etapes.map((etape, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3">
            <p className="mb-2 text-xs font-bold text-amber-600">Étape {etape.numero}</p>
            <Field
              label="Titre"
              value={etape.titre}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  etapes: c.etapes.map((e, idx) => (idx === i ? { ...e, titre: v } : e)),
                }))
              }
            />
            <div className="mt-2">
              <Field
                label="Description"
                multiline
                value={etape.description}
                onChange={(v) =>
                  setContent((c) => ({
                    ...c,
                    etapes: c.etapes.map((e, idx) => (idx === i ? { ...e, description: v } : e)),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </Block>

      <Block title="Services" section="services" value={content.services}>
        {content.services.map((service, i) => (
          <div key={service.id} className="rounded-lg border border-slate-100 p-3">
            <Field
              label="Libellé"
              value={service.label}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  services: c.services.map((s, idx) => (idx === i ? { ...s, label: v } : s)),
                }))
              }
            />
            <div className="mt-2">
              <Field
                label="Description"
                multiline
                value={service.description}
                onChange={(v) =>
                  setContent((c) => ({
                    ...c,
                    services: c.services.map((s, idx) => (idx === i ? { ...s, description: v } : s)),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </Block>

      <Block title="Pourquoi nous choisir" section="confiance" value={content.confiance}>
        {content.confiance.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3">
            <Field
              label="Libellé"
              value={item.label}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  confiance: c.confiance.map((it, idx) => (idx === i ? { ...it, label: v } : it)),
                }))
              }
            />
            <div className="mt-2">
              <Field
                label="Description"
                multiline
                value={item.description}
                onChange={(v) =>
                  setContent((c) => ({
                    ...c,
                    confiance: c.confiance.map((it, idx) => (idx === i ? { ...it, description: v } : it)),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </Block>

      <Block title="FAQ" section="faq" value={content.faq}>
        {content.faq.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3">
            <Field
              label="Question"
              value={item.question}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  faq: c.faq.map((it, idx) => (idx === i ? { ...it, question: v } : it)),
                }))
              }
            />
            <div className="mt-2">
              <Field
                label="Réponse"
                multiline
                value={item.reponse}
                onChange={(v) =>
                  setContent((c) => ({
                    ...c,
                    faq: c.faq.map((it, idx) => (idx === i ? { ...it, reponse: v } : it)),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </Block>
    </div>
  );
}

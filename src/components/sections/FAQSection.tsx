"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" className="bg-slate-50">
      <SectionHeading title="Questions fréquentes" />
      <div className="mx-auto max-w-2xl divide-y divide-slate-200 rounded-2xl bg-white card-elevated">
        {siteConfig.faq.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold text-navy-900"
              >
                {item.question}
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && <p className="px-5 pb-5 text-sm text-slate-500">{item.reponse}</p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

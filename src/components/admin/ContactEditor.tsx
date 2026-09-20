"use client";

import { useState } from "react";
import { Field, Block } from "@/components/admin/TextEditor";

type Contact = { phoneNumber: string; whatsappNumber: string; email: string };
type Legal = { companyName: string; siret: string; address: string };

export function ContactEditor({
  initialContact,
  initialLegal,
}: {
  initialContact: Contact;
  initialLegal: Legal;
}) {
  const [contact, setContact] = useState(initialContact);
  const [legal, setLegal] = useState(initialLegal);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-navy-900">Coordonnées</h2>
      <p className="text-sm text-slate-500">
        Le téléphone est utilisé partout sur le site (boutons Appeler, liens tel:, suivi des
        appels). Vérifiez bien le format avant d&apos;enregistrer : 10 chiffres, ex.{" "}
        <code>0754471250</code>.
      </p>

      <Block title="Téléphone, WhatsApp, email" section="contact" value={contact}>
        <Field
          label="Téléphone (10 chiffres, sans espaces)"
          value={contact.phoneNumber}
          onChange={(v) => setContact((c) => ({ ...c, phoneNumber: v }))}
        />
        <Field
          label="Numéro WhatsApp (format international sans +, ex. 33754471250 — laisser vide pour masquer le bouton WhatsApp)"
          value={contact.whatsappNumber}
          onChange={(v) => setContact((c) => ({ ...c, whatsappNumber: v }))}
        />
        <Field
          label="Email"
          value={contact.email}
          onChange={(v) => setContact((c) => ({ ...c, email: v }))}
        />
      </Block>

      <Block title="Informations légales (société)" section="legal" value={legal}>
        <Field
          label="Nom de la société"
          value={legal.companyName}
          onChange={(v) => setLegal((c) => ({ ...c, companyName: v }))}
        />
        <Field
          label="SIRET"
          value={legal.siret}
          onChange={(v) => setLegal((c) => ({ ...c, siret: v }))}
        />
        <Field
          label="Adresse postale"
          value={legal.address}
          onChange={(v) => setLegal((c) => ({ ...c, address: v }))}
        />
        <p className="text-xs text-slate-500">
          Ces 3 champs pilotent aussi l&apos;affichage des mentions légales et des données
          structurées du site — ils ne s&apos;activent que lorsque les 3 sont remplis.
        </p>
      </Block>
    </div>
  );
}

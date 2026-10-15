"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clientAuth } from "@/lib/auth-client";
import {
  cheminRetourSecurise,
  validerNomInscription,
} from "@/lib/nomInscription";

const classeChamp =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20";

/** Étape suivant l'inscription : saisie facultative du « Prénom Nom ». */
export default function FormulaireNomInscription() {
  const suite = cheminRetourSecurise(useSearchParams()?.get("suite"));
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const valider = async (evenement: FormEvent) => {
    evenement.preventDefault();
    const resultat = validerNomInscription(nom);
    if ("erreur" in resultat) {
      setErreur(resultat.erreur);
      return;
    }
    setEnCours(true);
    setErreur("");
    const reponse = await clientAuth.updateUser({ name: resultat.nom });
    if (reponse.error) {
      setEnCours(false);
      setErreur(
        "Impossible d'enregistrer votre nom. Réessayez ou ignorez cette étape.",
      );
      return;
    }
    window.location.assign(suite);
  };

  return (
    <form onSubmit={valider} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700">
        Prénom et nom
        <input
          value={nom}
          onChange={(evenement) => setNom(evenement.target.value)}
          autoComplete="name"
          maxLength={100}
          className={classeChamp}
        />
      </label>
      {erreur && (
        <p role="alert" className="text-sm text-rose-700">
          {erreur}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => window.location.assign(suite)}
          disabled={enCours}
          className="text-sm text-zinc-600 underline disabled:opacity-60"
        >
          Ignorer
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Valider
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DialogConfirmationSaisie } from "@/components/DialogConfirmationSaisie";
import { clientAuth } from "@/lib/auth-client";
import type { ParametresGroupe } from "@/lib/parametresGroupe";

interface SuppressionGroupeProps {
  readonly nomGroupe: string;
  readonly parametres: ParametresGroupe;
}

/** Zone « danger » des paramètres du groupe : suppression différée du groupe (Trésorier). */
export function SuppressionGroupe({
  nomGroupe,
  parametres,
}: SuppressionGroupeProps) {
  const routeur = useRouter();
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const fermer = () => {
    if (enCours) return;
    setDialogOuvert(false);
    setErreur("");
  };

  const supprimer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      const reponse = await fetch("/api/group/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: nomGroupe }),
      });
      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErreur(corps?.error ?? "Impossible de supprimer le groupe.");
        return;
      }
      await clientAuth.organization.setActive({ organizationId: null });
      routeur.replace("/");
    } catch {
      setErreur("Impossible de supprimer le groupe. Réessayez.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-lg font-semibold text-red-900">
        Supprimer le groupe
      </h2>
      <p className="mt-1 text-sm text-red-900">
        Les données du groupe vous sont envoyées par e-mail, puis le groupe est
        définitivement supprimé après 30 jours. Les comptes des membres ne sont
        pas supprimés.
      </p>
      <button
        type="button"
        onClick={() => setDialogOuvert(true)}
        className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
      >
        Supprimer le groupe
      </button>

      {dialogOuvert && (
        <DialogConfirmationSaisie
          id="titre-suppression-groupe"
          titre="Supprimer le groupe"
          motConfirmation={nomGroupe}
          libelleConfirmation={erreur ? "Réessayer" : "Supprimer le groupe"}
          libelleEnCours="Envoi des données et suppression…"
          enCours={enCours}
          erreur={erreur}
          onConfirmer={() => void supprimer()}
          onFermer={fermer}
        >
          <p>
            Le groupe <strong>{nomGroupe}</strong> sera supprimé. Seront perdus
            à l’issue des 30 jours :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              les membres, les unités, les signataires et les paramètres du
              groupe{parametres.ndfSigneeActif && ", dont le logo personnalisé"}
            </li>
            {parametres.historiqueActif && (
              <li>l’historique des dépenses, recettes et notes de frais</li>
            )}
            {parametres.budgetActif && (
              <li>les postes budgétaires et les budgets</li>
            )}
            {parametres.ndfSigneeActif && (
              <li>
                les notes de frais en cours de signature, annulées dès
                maintenant
              </li>
            )}
          </ul>
          <p>
            {parametres.historiqueActif &&
              "Les responsables du groupe recevront par e-mail l’historique en CSV" +
                (parametres.budgetActif ? " et le budget en CSV. " : ". ")}
            Le groupe reste réactivable pendant 30 jours depuis la liste de vos
            groupes. Les comptes des membres ne sont pas supprimés.
          </p>
        </DialogConfirmationSaisie>
      )}
    </div>
  );
}

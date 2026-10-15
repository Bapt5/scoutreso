import { Suspense } from "react";
import FormulaireNomInscription from "@/components/FormulaireNomInscription";

/** Étape d'inscription : saisie facultative du prénom et du nom. */
export default function PageBienvenue() {
  return (
    <main className="min-h-screen bg-zinc-50 p-4">
      <div className="mx-auto max-w-md space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900">Bienvenue</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Indiquez votre prénom et votre nom : ils apparaîtront notamment sur
            les notes de frais signées. Sans saisie, votre adresse e-mail est
            utilisée.
          </p>
        </header>
        <Suspense>
          <FormulaireNomInscription />
        </Suspense>
      </div>
    </main>
  );
}

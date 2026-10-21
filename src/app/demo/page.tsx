import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BoutonLancerDemo } from "@/components/demo/BoutonLancerDemo";
import { LogoScoutreso } from "@/components/LogoScoutreso";
import { recupererBacASableCourant } from "@/lib/demo/bacASable";
import { estModeDemo } from "@/lib/demo/mode";
import { recupererSession } from "@/lib/sessionServeur";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Essayer sans compte",
  description:
    "Essayez Scoutréso en un clic, sans compte, dans un groupe fictif.",
};

export default async function PageDemo() {
  if (!estModeDemo()) notFound();

  const session = await recupererSession();
  if (session && (await recupererBacASableCourant(session.user.id)))
    redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm w-full max-w-lg mx-auto">
        <div className="p-6 text-center border-b border-zinc-200">
          <h1 className="flex justify-center">
            <LogoScoutreso className="h-14" />
          </h1>
          <p className="text-zinc-500 mt-2">Démo, sans compte</p>
        </div>
        <div className="p-6 space-y-4 text-zinc-800">
          <p>
            Vous incarnez le <strong>trésorier</strong> d&apos;un groupe fictif,
            déjà rempli : unités, membres, historique, budgets et notes de frais
            à signer.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
            <li>
              Aucun e-mail n&apos;est réellement envoyé : une boîte mail
              virtuelle affiche ceux que l&apos;application aurait envoyés.
            </li>
            <li>
              Ne saisissez pas de vraies données personnelles : tout ce que vous
              écrivez est conservé le temps de la démo.
            </li>
          </ul>
          <form method="post" action="/api/demo/demarrer">
            <BoutonLancerDemo />
          </form>
        </div>
      </div>
    </main>
  );
}

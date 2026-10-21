import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { identifiantBacDeLaSession, listerMails } from "@/lib/demo/bacASable";
import { estModeDemo } from "@/lib/demo/mode";
import { recupererSession } from "@/lib/sessionServeur";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Boîte mail de la démo" };

const formaterDate = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));

export default async function PageBoiteMail({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  if (!estModeDemo()) notFound();
  const identifiantBac = await identifiantBacDeLaSession();
  const session = await recupererSession();
  if (!identifiantBac || !session) redirect("/demo");

  const { filtre } = await searchParams;
  const pourMoi = filtre !== "tous";
  const mails = await listerMails(
    identifiantBac,
    pourMoi ? session.user.email : undefined,
  );
  const classeOnglet = (actif: boolean) =>
    `rounded-full px-3 py-1 text-sm ${
      actif
        ? "bg-zinc-900 text-white"
        : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
    }`;

  return (
    <main className="min-h-screen bg-zinc-50 p-4">
      <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Boîte mail de la démo
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Les e-mails que l&apos;application aurait envoyés. Aucun
              n&apos;est réellement parti.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline">
            Retour
          </Link>
        </header>
        <nav className="flex gap-2" aria-label="Filtre des mails">
          <Link
            href="/demo/mail"
            className={classeOnglet(pourMoi)}
            aria-current={pourMoi ? "page" : undefined}
          >
            Pour moi (trésorier)
          </Link>
          <Link
            href="/demo/mail?filtre=tous"
            className={classeOnglet(!pourMoi)}
            aria-current={!pourMoi ? "page" : undefined}
          >
            Tous
          </Link>
        </nav>
        {mails.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Aucun mail pour l&apos;instant. Envoyez une dépense ou traitez une
            note à signer pour en voir arriver.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {mails.map((mail) => (
              <li key={mail.id}>
                <Link
                  href={`/demo/mail/${mail.id}`}
                  className="block p-3 hover:bg-zinc-50"
                >
                  <p
                    className={`text-zinc-900 ${mail.lu ? "" : "font-semibold"}`}
                  >
                    {!mail.lu && (
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-600"
                        role="img"
                        aria-label="Non lu"
                      />
                    )}
                    {mail.sujet}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    À {mail.destinataires.join(", ")} ·{" "}
                    {formaterDate(mail.creeLe)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { identifiantBacDeLaSession, ouvrirMail } from "@/lib/demo/bacASable";
import { estModeDemo } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mail de la démo" };

const formaterTaille = (octets: number) =>
  octets < 1024 * 1024
    ? `${Math.max(1, Math.round(octets / 1024))} Ko`
    : `${(octets / (1024 * 1024)).toFixed(1)} Mo`;

export default async function PageMail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!estModeDemo()) notFound();
  const identifiantBac = await identifiantBacDeLaSession();
  if (!identifiantBac) redirect("/demo");

  const { id } = await params;
  const mail = await ouvrirMail(identifiantBac, id);
  if (!mail) notFound();

  return (
    <main className="min-h-screen bg-zinc-50 p-4">
      <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <Link href="/demo/mail" className="text-sm text-zinc-600 underline">
          ← Boîte mail
        </Link>
        <header className="space-y-1 border-b border-zinc-200 pb-4 text-sm text-zinc-700">
          <h1 className="text-xl font-semibold text-zinc-900">{mail.sujet}</h1>
          <p>
            <span className="font-medium">De :</span> Scoutréso (démo)
          </p>
          <p>
            <span className="font-medium">À :</span>{" "}
            {mail.destinataires.join(", ")}
          </p>
          <p>
            <span className="font-medium">Date :</span>{" "}
            {new Intl.DateTimeFormat("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(mail.creeLe))}
          </p>
          {mail.piecesJointes.length > 0 && (
            <div>
              <p className="font-medium">Pièces jointes :</p>
              <ul className="list-inside list-disc">
                {mail.piecesJointes.map((pieceJointe, index) => (
                  <li key={`${pieceJointe.nom}-${index}`}>
                    {pieceJointe.nom} ({formaterTaille(pieceJointe.taille)})
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-zinc-500">
                Dans la démo, les pièces jointes sont listées mais jamais
                conservées.
              </p>
            </div>
          )}
        </header>
        <iframe
          title={`Contenu du mail : ${mail.sujet}`}
          src={`/api/demo/mails/${mail.id}/html`}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="h-[70vh] w-full rounded-lg border border-zinc-200 bg-white"
        />
      </div>
    </main>
  );
}

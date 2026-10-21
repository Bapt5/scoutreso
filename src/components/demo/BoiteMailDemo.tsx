"use client";

import { useEffect, useRef, useState } from "react";

const INTERVALLE_MS = 4000;
const DUREE_TOAST_MS = 8000;
const MAX_TOASTS = 3;

interface MailRecu {
  id: string;
  sujet: string;
  destinataires: string[];
}

interface ReponseMails {
  mails: MailRecu[];
  nonLus: number;
  curseur: string | null;
}

/**
 * Interroge la boîte mail virtuelle de la démo et affiche une pop-up pour
 * chaque nouveau mail. Le sondage s'arrête quand l'onglet est masqué.
 * `onNonLus` reçoit le nombre de mails non lus, ou null si la boîte est
 * indisponible (visiteur sans bac à sable).
 */
export function BoiteMailDemo({
  onNonLus,
}: {
  onNonLus?: (nonLus: number | null) => void;
}) {
  const [toasts, setToasts] = useState<MailRecu[]>([]);
  const curseur = useRef<string | null | undefined>(undefined);
  const dejaVus = useRef(new Set<string>());

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let arrete = false;

    const interroger = async () => {
      try {
        const parametre =
          curseur.current === undefined
            ? ""
            : `?apres=${encodeURIComponent(curseur.current ?? "debut")}`;
        const reponse = await fetch(`/api/demo/mails${parametre}`, {
          cache: "no-store",
        });
        if (arrete) return;
        if (reponse.status === 401) {
          onNonLus?.(null);
          curseur.current = undefined;
        } else if (reponse.ok) {
          const donnees = (await reponse.json()) as ReponseMails;
          if (arrete) return;
          curseur.current = donnees.curseur;
          onNonLus?.(donnees.nonLus);
          const nouveaux = donnees.mails.filter(
            (mail) => !dejaVus.current.has(mail.id),
          );
          for (const mail of nouveaux) {
            dejaVus.current.add(mail.id);
            setTimeout(
              () =>
                setToasts((actuels) => actuels.filter((t) => t.id !== mail.id)),
              DUREE_TOAST_MS,
            );
          }
          if (nouveaux.length > 0)
            setToasts((actuels) =>
              [...actuels, ...nouveaux].slice(-MAX_TOASTS),
            );
        }
      } catch {
        // Réseau indisponible : on réessaie au prochain passage.
      }
      if (!arrete && document.visibilityState === "visible")
        minuteur = setTimeout(() => void interroger(), INTERVALLE_MS);
    };

    const auChangementDeVisibilite = () => {
      clearTimeout(minuteur);
      if (document.visibilityState === "visible") void interroger();
    };

    document.addEventListener("visibilitychange", auChangementDeVisibilite);
    if (document.visibilityState === "visible") void interroger();
    return () => {
      arrete = true;
      clearTimeout(minuteur);
      document.removeEventListener(
        "visibilitychange",
        auChangementDeVisibilite,
      );
    };
  }, [onNonLus]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((mail) => (
        <div
          key={mail.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-900 shadow-lg"
        >
          <p className="min-w-0 flex-1">
            Nouveau mail : {mail.sujet}, à {mail.destinataires[0] ?? "?"}
          </p>
          <button
            type="button"
            onClick={() => {
              window.open(`/demo/mail/${mail.id}`, "_blank");
              setToasts((actuels) => actuels.filter((t) => t.id !== mail.id));
            }}
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-800"
          >
            Ouvrir
          </button>
        </div>
      ))}
    </div>
  );
}

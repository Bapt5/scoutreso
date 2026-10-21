"use client";

/** Bandeau compact de la démo : état, boîte mail, réinitialisation. */
export function BandeauDemo({ nonLus }: { nonLus: number }) {
  // Lecture littérale : inlinée au build, comme NEXT_PUBLIC_DEMO_MODE.
  const urlAppProd = process.env.NEXT_PUBLIC_URL_APP_PROD;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-950">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1">
          Démo, aucun mail réellement envoyé, données effacées après 24 h
        </p>
        <a
          href="/demo/mail"
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-amber-950 px-2.5 py-1 font-medium text-white hover:bg-amber-900"
        >
          Boîte mail ({nonLus})
        </a>
        <form method="post" action="/api/demo/reinitialiser">
          <button
            type="submit"
            className="rounded-md border border-amber-900 px-2.5 py-1 font-medium hover:bg-amber-200"
          >
            Réinitialiser la démo
          </button>
        </form>
        {urlAppProd && (
          <a
            href={urlAppProd}
            onClick={() => {
              const umami = (
                window as { umami?: { track: (evenement: string) => void } }
              ).umami;
              umami?.track("demo-creer-vrai-groupe");
            }}
            className="font-medium underline"
          >
            Créer mon vrai groupe
          </a>
        )}
      </div>
    </div>
  );
}

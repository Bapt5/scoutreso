export interface ActionAccueil {
  theme: "brand" | "alt";
  text: string;
  link: string;
}

/**
 * Boutons du hero de la page d'accueil, d'après les URL de l'application de
 * production et de la démo (lues au build, voir config.mts). Sans URL de
 * production, « Je suis responsable de groupe » et « Je suis membre du
 * groupe » sont masqués ; sans URL de démo, « Essayer sans compte » l'est.
 */
export function actionsAccueil(urls: {
  urlAppProd?: string;
  urlAppDemo?: string;
}): ActionAccueil[] {
  const urlAppProd = urls.urlAppProd?.trim();
  const urlAppDemo = urls.urlAppDemo?.trim();
  return [
    ...(urlAppProd
      ? [
          {
            theme: "brand" as const,
            text: "Je suis responsable de groupe",
            link: urlAppProd,
          },
        ]
      : []),
    ...(urlAppDemo
      ? [
          {
            theme: "alt" as const,
            text: "Essayer sans compte",
            link: urlAppDemo,
          },
        ]
      : []),
    ...(urlAppProd
      ? [
          {
            theme: "alt" as const,
            text: "Je suis membre du groupe",
            link: "#rejoindre-un-groupe",
          },
        ]
      : []),
  ];
}

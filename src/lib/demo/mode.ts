// Lecture littérale : la variable est inlinée au build, ce qui retire le code
// d'interface de la démo du bundle de production.
export const estModeDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const INDISPONIBLES_EN_DEMO = [
  "invitation-membres",
  "creation-groupe",
  "suppression-groupe",
  "suppression-compte",
  "identifiants-compte",
  "depot-note-signee",
] as const;

export type FonctionnaliteDemo = (typeof INDISPONIBLES_EN_DEMO)[number];

/** Faux en démo pour les fonctionnalités qui n'ont pas de sens dans un bac à sable. */
export const fonctionnaliteDisponibleEnDemo = (
  nom: FonctionnaliteDemo,
): boolean => !estModeDemo() || !INDISPONIBLES_EN_DEMO.includes(nom);

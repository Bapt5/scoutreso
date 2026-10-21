// Lecture littérale : la variable est inlinée au build, ce qui retire le code
// d'interface de la démo du bundle de production.
export const estModeDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true";

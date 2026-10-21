"use client";

export function BoutonLancerDemo() {
  return (
    <button
      type="submit"
      onClick={() => {
        const umami = (
          window as { umami?: { track: (evenement: string) => void } }
        ).umami;
        umami?.track("demo-lancee");
      }}
      className="w-full rounded-md bg-blue-900 px-4 py-3 font-semibold text-white hover:bg-blue-800"
    >
      Lancer la démo
    </button>
  );
}

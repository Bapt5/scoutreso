"use client";

import { useState } from "react";
import { BandeauDemo } from "@/components/demo/BandeauDemo";
import { BoiteMailDemo } from "@/components/demo/BoiteMailDemo";

/**
 * Monté dans le layout racine en démo. Le bandeau n'apparaît qu'une fois la
 * boîte mail jointe, c'est-à-dire quand le visiteur a un bac à sable.
 */
export function ConteneurDemo() {
  const [nonLus, setNonLus] = useState<number | null>(null);
  return (
    <>
      {nonLus !== null && <BandeauDemo nonLus={nonLus} />}
      <BoiteMailDemo onNonLus={setNonLus} />
    </>
  );
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { jsonError } from "@/lib/api/utils";
import { estModeDemo } from "@/lib/demo/mode";
import { purgerBacsASable } from "@/lib/demo/purge";
import { purgerGroupesEchus } from "@/lib/suppressionGroupe";

function secretValide(requete: Request, secret: string) {
  const attendu = Buffer.from(`Bearer ${secret}`);
  const recu = Buffer.from(requete.headers.get("authorization") ?? "");
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

/**
 * Purge les groupes dont le délai de suppression est écoulé. Optionnel : à
 * appeler depuis un planificateur (cron Vercel, crontab…) avec
 * `Authorization: Bearer <CRON_SECRET>`. Sans CRON_SECRET la route n'existe pas.
 */
async function purger(requete: Request) {
  return executerRouteAvecLogs(requete, async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return jsonError("Introuvable", 404);
    if (!secretValide(requete, secret)) return jsonError("Non autorisé", 401);
    const purges = await purgerGroupesEchus();
    if (estModeDemo())
      return NextResponse.json({
        purges,
        bacsASablePurges: await purgerBacsASable(),
      });
    return NextResponse.json({ purges });
  });
}

// Les crons Vercel appellent en GET, les autres planificateurs en POST.
export const GET = purger;
export const POST = purger;

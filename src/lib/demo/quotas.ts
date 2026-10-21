import { createHmac } from "node:crypto";
import { entetesIpDeConfiance } from "@/lib/api/entetesIpConfiance";
import { pool } from "@/lib/baseDeDonnees";
import {
  MAX_BACS_A_SABLE_ACTIFS,
  MAX_CREATIONS_PAR_IP_PAR_HEURE,
} from "@/lib/demo/constantes";

/** HMAC de l'IP du visiteur : l'adresse en clair n'est jamais stockée. */
export function hacherIp(entetes: Headers) {
  const ip = entetes.get(entetesIpDeConfiance()[0])?.split(",")[0]?.trim();
  const secret = process.env.AUDIT_LOG_SECRET || process.env.BETTER_AUTH_SECRET;
  return createHmac("sha256", secret ?? "")
    .update(ip || "inconnue")
    .digest("hex");
}

/**
 * Quotas comptés en base (un compteur en mémoire ne tient pas sur Vercel, où
 * chaque instance a le sien) : créations par IP sur l'heure écoulée, puis
 * nombre total de bacs à sable actifs.
 */
export async function verifierQuotas(ipHachee: string) {
  const resultat = await pool.query<{ par_ip: number; actifs: number }>(
    `SELECT COUNT(*) FILTER (WHERE ip_hachee = $1 AND cree_le > now() - interval '1 hour')::int AS par_ip,
            COUNT(*) FILTER (WHERE expire_le > now())::int AS actifs
       FROM scouticket_demo_bac_a_sable`,
    [ipHachee],
  );
  const { par_ip, actifs } = resultat.rows[0];
  if (par_ip >= MAX_CREATIONS_PAR_IP_PAR_HEURE) return "ip" as const;
  if (actifs >= MAX_BACS_A_SABLE_ACTIFS) return "global" as const;
  return "ok" as const;
}

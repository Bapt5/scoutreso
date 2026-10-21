/**
 * En-tête HTTP qui porte l'adresse IP du visiteur, posé ou écrasé par notre
 * proxy. Un seul en-tête : en lister plusieurs permettrait à un client
 * d'usurper son IP en envoyant celui que le proxy n'écrase pas.
 */
export function entetesIpDeConfiance(
  environnement: Record<string, string | undefined> = process.env,
): string[] {
  // Vercel écrase x-real-ip avec l'IP publique du visiteur.
  if (environnement.VERCEL) return ["x-real-ip"];
  // Cloudflare Tunnel (auto-hébergement) transmet l'IP dans cf-connecting-ip.
  return ["cf-connecting-ip"];
}

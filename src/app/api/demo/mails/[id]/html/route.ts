import { executerRouteAvecLogs } from "@/lib/api/routeAvecLogs";
import { jsonError } from "@/lib/api/utils";
import { identifiantBacDeLaSession, lireCorpsMail } from "@/lib/demo/bacASable";
import { estModeDemo } from "@/lib/demo/mode";
import { echapperHtml } from "@/lib/email";

/** Corps du mail, servi pour l'iframe de la boîte mail virtuelle. */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return executerRouteAvecLogs(requete, async () => {
    if (!estModeDemo()) return jsonError("Introuvable", 404);
    const identifiantBac = await identifiantBacDeLaSession();
    if (!identifiantBac) return jsonError("Non autorisé", 401);

    const { id } = await params;
    const mail = await lireCorpsMail(identifiantBac, id);
    if (!mail) return jsonError("Introuvable", 404);

    // Le HTML est déjà échappé par les gabarits d'e-mail : la CSP et le bac à
    // sable de l'iframe ne sont qu'une seconde protection. Les liens du mail
    // s'ouvrent dans un nouvel onglet (allow-popups).
    const corps =
      mail.html ??
      `<pre style="white-space:pre-wrap;font-family:inherit">${echapperHtml(mail.texte ?? "")}</pre>`;
    return new Response(`<base target="_blank">${corps}`, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; sandbox allow-popups allow-popups-to-escape-sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });
}

import { executerDansBacASable } from "@/lib/demo/boiteMail";
import type { BacASableCree } from "@/lib/demo/semis";
import { envoyerEmailTourDeSigner } from "@/lib/emailSignatureNdf";

/**
 * Dépose dans la boîte mail du bac à sable l'e-mail « note de frais à
 * traiter » de chaque note semée : c'est par ce lien que le trésorier (le
 * visiteur) accède à l'écran de signature, comme en production.
 */
export async function notifierNotesSemees(bac: BacASableCree) {
  await executerDansBacASable(bac.identifiantBac, async () => {
    for (const note of bac.notes)
      await envoyerEmailTourDeSigner({
        destinataire: bac.email,
        noteDeFraisId: note.id,
        etape: "tresorier",
        groupe: note.groupe,
        demandeur: note.demandeur,
        montant: `${note.montant.toFixed(2)} €`,
        rib: note.rib,
      });
  });
}

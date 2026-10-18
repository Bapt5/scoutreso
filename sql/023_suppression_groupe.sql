-- Suppression différée d'un groupe : tant que suppression_demandee_le est
-- renseigné, le groupe est « en suppression » (inaccessible, réactivable) ;
-- passé 30 jours, la purge supprime l'organisation et, en cascade, toutes ses
-- données. suppression_demandee_par n'a volontairement pas de clé étrangère
-- pour survivre à une suppression de compte.
ALTER TABLE scouticket_group_data
  ADD COLUMN IF NOT EXISTS suppression_demandee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_demandee_par TEXT;

CREATE INDEX IF NOT EXISTS scouticket_group_data_suppression_idx
  ON scouticket_group_data (suppression_demandee_le)
  WHERE suppression_demandee_le IS NOT NULL;

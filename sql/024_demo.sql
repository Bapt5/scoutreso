-- Mode démo : un bac à sable jetable par visiteur et la boîte mail virtuelle
-- qui capture les e-mails au lieu de les envoyer. Tables sans effet (vides)
-- hors du projet de démonstration.
CREATE TABLE IF NOT EXISTS scouticket_demo_bac_a_sable (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  utilisateur_id TEXT NOT NULL,
  ip_hachee TEXT NOT NULL,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS scouticket_demo_bac_a_sable_ip_idx
  ON scouticket_demo_bac_a_sable (ip_hachee, cree_le);
CREATE INDEX IF NOT EXISTS scouticket_demo_bac_a_sable_expire_idx
  ON scouticket_demo_bac_a_sable (expire_le);

CREATE TABLE IF NOT EXISTS scouticket_demo_mail (
  id TEXT PRIMARY KEY,
  bac_a_sable_id TEXT NOT NULL
    REFERENCES scouticket_demo_bac_a_sable (id) ON DELETE CASCADE,
  destinataires TEXT[] NOT NULL,
  sujet TEXT NOT NULL,
  html TEXT,
  texte TEXT,
  pieces_jointes JSONB NOT NULL DEFAULT '[]',
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  lu_le TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS scouticket_demo_mail_bac_idx
  ON scouticket_demo_mail (bac_a_sable_id, cree_le);

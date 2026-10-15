-- Unités pré-attribuées à une invitation en attente, avant que l'invité n'ait
-- (ou n'accepte) un compte. À l'acceptation, elles sont copiées vers
-- scouticket_acces_unite_membre puis supprimées ; au refus, elles sont
-- supprimées ; à l'annulation, la suppression de l'invitation les emporte en
-- cascade. Le rôle prévu est porté par invitation.role (Better Auth).
CREATE TABLE IF NOT EXISTS scouticket_invitation_unite (
  invitation_id TEXT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  unite_id TEXT NOT NULL,
  PRIMARY KEY (invitation_id, unite_id),
  FOREIGN KEY (organization_id, unite_id)
    REFERENCES scouticket_unites (organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS scouticket_invitation_unite_org_idx
  ON scouticket_invitation_unite (organization_id, unite_id);

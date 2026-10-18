# Suppression d'un groupe

Le Trésorier (rôle `owner`) peut supprimer son groupe depuis `/parametres-groupe`, tout en bas (zone « Supprimer le groupe »). La suppression est **différée de 30 jours** : le groupe est d'abord marqué « en suppression » (réactivable), puis purgé définitivement. Les comptes des membres ne sont jamais supprimés.

## Déroulé

1. **Demande** (`POST /api/group/suppression`, `owner` uniquement). Le dialog exige la saisie exacte du nom du groupe et liste ce qui sera perdu selon les options activées (historique, suivi budgétaire, notes de frais signées, logo).
2. **E-mail de sauvegarde** (`src/lib/emailSuppressionGroupe.ts`) à tous les responsables (`owner` et `admin`) : nom du groupe, date de suppression définitive, et en pièces jointes `historique.csv` (si `historique_actif`, toutes les lignes, sans le plafond de l'export interactif) et un `suivi-budgetaire-<année>.csv` par année comptable (si `budget_actif`).
3. **Marquage**, dans une transaction, **uniquement après l'envoi réussi** : les notes de frais signées en cours sont supprimées (elles contiennent un PDF et un RIB), les invitations en attente aussi, puis `scouticket_group_data.suppression_demandee_le` et `suppression_demandee_par` sont renseignés (migration `sql/023_suppression_groupe.sql`). Si l'e-mail échoue, rien n'est modifié : l'API répond 502 et l'interface propose « Réessayer ».
4. **Période de 30 jours** : le groupe est traité comme s'il n'y avait pas de groupe actif (`recupererContexteGroupe` renvoie un identifiant d'organisation `null`, donc toutes les routes de groupe répondent « Sélectionnez un groupe »). Sur l'accueil, il apparaît grisé avec la date de suppression définitive. Un responsable peut le réactiver (`POST /api/group/reactivation`, après confirmation) ; la liste des groupes de l'accueil vient de `GET /api/user/groupes`, qui renvoie chaque groupe avec son état (`suppressionDefinitiveLe` non nul = en suppression). C'est la source unique de l'accueil, qui n'utilise plus la liste Better Auth (elle ignore cet état) et n'affiche rien tant que cette réponse n'est pas arrivée (écran d'attente, ou « Réessayer » en cas d'échec). Elle est rechargée à chaque changement de groupe actif et au retour sur l'onglet.
5. **Purge** (`purgerGroupesEchus`, `src/lib/suppressionGroupe.ts`) : supprime l'`organization` (et en cascade toutes les tables du groupe), ses membres et invitations, et remet à `NULL` le groupe actif des sessions concernées.

## Pendant la période de suppression

- Un membre peut quitter le groupe, y compris le dernier responsable (`POST /api/group/leave` le retire directement, sans passer par la règle « seul responsable » de Better Auth).
- Un utilisateur peut supprimer son compte : `verifierSuppressionCompte` le retire d'abord des groupes en suppression, seuls les autres groupes le bloquent.
- L'API native `organization.delete` de Better Auth est désactivée (`disableOrganizationDeletion`), pour qu'on ne puisse pas contourner la sauvegarde et le délai.

## Automatiser la purge sans cron

Vercel ne fournit pas de cron utilisable ici, la purge repose donc sur deux mécanismes complémentaires :

- **Purge paresseuse (par défaut, rien à configurer)** : `recupererContexteGroupe` appelle `declencherPurgeParesseuse`, qui lance la purge après la réponse (`after()`), au plus une fois par heure et par instance, sans jamais faire échouer la requête. Un verrou consultatif PostgreSQL (`pg_try_advisory_xact_lock`) évite les purges concurrentes. **Limite** : si personne n'utilise l'application, un groupe échu reste en base jusqu'à la prochaine requête d'un utilisateur connecté (de n'importe quel groupe).
- **Endpoint optionnel** `GET`/`POST /api/cron/purge-groupes`, protégé par `Authorization: Bearer <CRON_SECRET>` (comparaison à temps constant). Sans `CRON_SECRET`, la route répond 404. À brancher sur n'importe quel planificateur (cron Vercel quotidien, crontab, GitHub Actions…) pour une purge à l'heure près.

## Journalisation et RGPD

- Événements journalisés (catégorie `groupe`) : `groupe.suppression_demandee`, `groupe.reactive`, `groupe.purge`, `groupe.purge_echouee`, sans donnée personnelle (identifiants uniquement).
- Rétention : 30 jours après la demande pour les données du groupe, puis suppression définitive. Les e-mails de sauvegarde restent dans les boîtes des responsables, sous leur responsabilité.
- `suppression_demandee_par` est un identifiant sans clé étrangère : il survit à la suppression du compte de son auteur et disparaît avec la ligne `scouticket_group_data` à la purge.

# Démo sans compte

La démo permet d'essayer Scoutréso en un clic, sans compte. Le visiteur incarne le **trésorier** d'un groupe fictif déjà rempli, dans un **bac à sable jetable** qui lui est propre. Aucun e-mail n'est réellement envoyé : une boîte mail virtuelle affiche ceux que l'application aurait envoyés.

Elle tourne sur un **second projet** (par exemple `demo.scoutreso.me`), construit depuis le même dépôt, avec sa propre base PostgreSQL. La production n'est pas affectée : le mode démo n'existe que si `NEXT_PUBLIC_DEMO_MODE=true` au build.

## Ce que le visiteur peut faire

- Envoyer des dépenses et des recettes (scan inclus), gérer les membres (rôles, accès aux unités), les unités, la nomenclature et les signataires.
- Consulter l'historique et le suivi budgétaire (un poste est proche de 85 % pour montrer l'alerte).
- Traiter l'étape trésorier de deux **notes de frais signées** déjà déposées (une classique, une kilométrique) : demander le code, le lire dans la boîte mail, signer ou refuser.

Ce qui est désactivé : le dépôt d'une **nouvelle** note de frais signée, l'invitation de membres, la création et la suppression d'un groupe, la suppression du compte, le changement d'e-mail et de mot de passe, l'installation en application (PWA). Le visiteur ne peut ni changer son propre rôle, ni se retirer du groupe.

## Principe : des points d'entrée, pas de pages dupliquées

Les pages de la production sont réutilisées telles quelles. Le mode démo se branche à quelques points précis, sur le modèle de `MAINTENANCE_MODE` :

| Point d'entrée                                                        | Effet en démo                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `envoyerMail()` et `creerTransporteurEmail()` (`src/lib/email.ts`)    | Le mail est capturé au lieu d'être envoyé ; créer un transporteur SMTP lève une erreur            |
| `src/proxy.ts` et `src/lib/demo/garde.ts`                             | Routes bloquées (403), pages sans objet redirigées vers `/demo`, `X-Robots-Tag: noindex`          |
| `src/app/layout.tsx`                                                  | Pas de service worker ni de manifeste, `noindex`, titre « Scoutréso Démo », bandeau et boîte mail |
| `src/lib/suppressionGroupe.ts` et `src/app/api/cron/purge-groupes`    | Purge aussi les bacs à sable expirés                                                              |
| `src/lib/auth.ts`                                                     | Inscription publique fermée, session de 24 heures                                                 |
| `src/app/api/send-expense/route.ts`                                   | Refuse le dépôt d'une note de frais signée (422, avec un message lisible par le formulaire)       |
| Composants (`fonctionnaliteDisponibleEnDemo`, `src/lib/demo/mode.ts`) | Masquent les boutons indisponibles                                                                |

Le code propre à la démo est isolé dans `src/lib/demo/`, `src/app/demo/`, `src/app/api/demo/`, `src/components/demo/`, `sql/024_demo.sql` et `scripts/`. Les routes `/demo` et `/api/demo/*` répondent 404 hors mode démo. `NEXT_PUBLIC_DEMO_MODE` est lue littéralement (`process.env.NEXT_PUBLIC_DEMO_MODE`) pour être remplacée au build, ce qui retire le code d'interface de la démo du bundle de production.

## Tester la démo en local

```bash
cp .env.demo.example .env.demo           # puis renseigner les valeurs (voir ci-dessous)
docker compose -f compose.demo.yaml up -d  # PostgreSQL jetable sur le port 5433
pnpm demo:migrate                        # tables Better Auth puis tables Scoutréso
pnpm demo:dev                            # http://localhost:3000/demo
```

- `.env.demo` n'est pas versionné. Ses valeurs l'emportent sur `.env` et `.env.local`. Il faut y mettre un certificat de démo (`pnpm ndf:certificat "Scoutreso Demo"`) pour pouvoir signer.
- La base de démo est distincte de la base de développement habituelle (port 5433).
- Sous `pnpm demo:dev`, le quota de créations par IP est relevé à 1000 par heure : en local toutes les requêtes ont la même IP, et se déconnecter puis relancer une démo crée un bac à chaque fois.
- `next dev` réécrit un bloc dans `AGENTS.md` à chaque lancement : ne le commitez pas.
- Après avoir créé une route ou un fichier pendant que le serveur tourne, redémarrez-le : le cache de développement peut renvoyer des 404.

## Déployer la démo

1. Créer un second projet Vercel sur le même dépôt et lui rattacher le domaine de la démo.
2. Créer une base PostgreSQL **dédiée** (jamais celle de la production).
3. Renseigner les variables listées dans [Variables d'environnement](/technical/environment-variables#demo), dont le certificat de démo généré avec `pnpm ndf:certificat "Scoutreso Demo"`.
4. Cocher « Automatically expose System Environment Variables » : la variable système `VERCEL` doit être définie à l'exécution pour que l'IP du visiteur soit lue dans `x-real-ip`.
5. Commande de build : `pnpm auth:migrate -y && pnpm db:migrate && pnpm build`. L'option `-y` évite la confirmation interactive de la migration Better Auth.
6. Optionnel : planifier la purge (voir plus bas).
7. Sur le site de documentation, définir `NEXT_PUBLIC_URL_APP_DEMO` (et `NEXT_PUBLIC_URL_APP_PROD`) dans l'environnement de build, puis reconstruire le site.

Les variables SMTP sont factices en démo (`demo` suffit) : aucun transport n'est jamais créé, mais `send-expense`, `send-recette` et `/api/health` exigent leur présence. Google doit rester désactivé (pas de `GOOGLE_CLIENT_ID` ni `GOOGLE_CLIENT_SECRET`).

## Le bac à sable

`POST /api/demo/demarrer` (bouton « Lancer la démo » de `/demo`, jamais un `GET`) crée un bac à sable en une transaction (`src/lib/demo/semis.ts`) :

- un groupe fictif, toutes les options actives, année comptable du 1er septembre ;
- sept utilisateurs aux adresses `<prénom>-<id>@demo.invalid` (domaine réservé, jamais réel) : le visiteur (trésorier), un responsable et cinq membres aux accès variés ;
- unités, nomenclature par défaut, signataires, postes budgétaires et budgets ;
- une trentaine d'entrées d'historique, dont des notes kilométriques, avec des dates relatives à aujourd'hui (resserrées si l'année comptable est commencée depuis moins de 86 jours) ;
- les deux notes de frais signées en cours, et leurs e-mails « note de frais à traiter » dans la boîte mail.

La session du visiteur est ouverte côté serveur (`signInEmail` avec un mot de passe dérivé de `BETTER_AUTH_SECRET`, haché une seule fois par instance), puis le groupe est rendu actif. Elle dure 24 heures, comme le bac à sable. Un visiteur qui revient avec une session valide retrouve le sien. « Réinitialiser la démo » (`POST /api/demo/reinitialiser`) en crée un nouveau et marque l'ancien expiré.

### Quotas

Comptés en base (`scouticket_demo_bac_a_sable`), pas en mémoire, car chaque instance Vercel a son propre compteur :

- **5 créations par IP et par heure.** L'IP est lue avec `entetesIpDeConfiance()` puis hachée en HMAC-SHA256 : elle n'est jamais stockée en clair. Une réinitialisation compte comme une création.
- **200 bacs à sable actifs au plus.** Quand le plafond est atteint, la purge est tentée d'abord.

Au-delà, la réponse est une page « La démo est momentanément saturée » (429). Les constantes sont dans `src/lib/demo/constantes.ts`.

### Purge

`purgerBacsASable()` (`src/lib/demo/purge.ts`) supprime les bacs expirés : leur organisation (la cascade SQL emporte le reste, dont les notes signées et la boîte mail) et leurs utilisateurs. Elle ne touche que les lignes référencées par la table des bacs, et seulement les utilisateurs dont l'adresse finit par `@demo.invalid`, même si `DATABASE_URL` pointait par erreur vers une vraie base. Elle est appelée par :

1. le crochet paresseux existant (`declencherPurgeParesseuse`, au plus une fois par heure et par instance) : c'est le mécanisme principal ;
2. la route `/api/cron/purge-groupes`, optionnelle, qui renvoie aussi `bacsASablePurges` ;
3. `POST /api/demo/demarrer`, quand le plafond global est atteint.

Aucun `vercel.json` n'est fourni : le plan Hobby de Vercel limite les crons à un par jour. Pour un planificateur externe, appeler la route en `GET` ou `POST` avec `Authorization: Bearer <CRON_SECRET>` (sans `CRON_SECRET`, elle répond 404).

## Boîte mail virtuelle

Tous les envois passent par `envoyerMail()`. En démo, le mail est enregistré dans `scouticket_demo_mail`, rattaché au bac à sable de la **session** (jamais au destinataire, que le visiteur peut saisir librement). Les pièces jointes sont listées par **nom et taille** seulement, leur contenu n'est jamais conservé. La boîte est plafonnée à 50 mails par bac.

- `BoiteMailDemo` interroge `GET /api/demo/mails` toutes les 4 secondes (pause quand l'onglet est masqué) et affiche une pop-up « Nouveau mail » avec un bouton « Ouvrir », qui ouvre le mail dans un nouvel onglet.
- `/demo/mail` liste les mails (« Pour moi (trésorier) » ou « Tous » : la boîte est unique, chaque mail affiche son destinataire, y compris les membres semés) ; `/demo/mail/[id]` affiche l'en-tête, les noms des pièces jointes et le contenu.
- Le contenu est servi par `/api/demo/mails/[id]/html` dans une iframe en bac à sable, avec une politique de sécurité stricte (`default-src 'none'`, pas de script) ; les liens s'ouvrent dans un nouvel onglet (`allow-popups`).
- Toutes les requêtes filtrent par le bac à sable de la session, jamais par l'identifiant du mail seul : un visiteur ne peut pas lire la boîte d'un autre.
- Les liens des mails pointent vers `APP_URL`, c'est-à-dire la démo : ils fonctionnent dans le même bac à sable.

## Notes de frais signées semées

La note et son PDF ne sont conservés que pendant le circuit : on ne sème donc que des notes **en cours**, à l'étape du trésorier. Les PDF d'exemple, déjà signés par le bénéficiaire et le responsable, sont versionnés dans `src/lib/demo/assets/` et insérés tels quels à chaque création de bac, avec de nouveaux identifiants. Chromium ne tourne jamais en démo : il ne sert qu'à produire ces PDF.

`empreintes.json` contient le hash du document initial de chaque PDF : il est repris dans `document_hash` pour que la signature du visiteur cite la même empreinte que les deux premières.

Les notes signées en démo ne passent pas la page « [Vérifier une note signée](/verifier-signature) » : l'empreinte publiée est celle de la production. C'est voulu, ne publiez pas l'empreinte du certificat de démo.

### Régénérer les PDF

```bash
pnpm demo:pdf
```

À relancer quand la **mise en page des notes** ou le **certificat de démo** changent, puis à commiter ensemble les PDF et `empreintes.json`. Il faut `.env.demo` (certificat) et un Chrome local (`PUPPETEER_EXECUTABLE_PATH`, lu dans `.env` à défaut). Le script appelle le vrai pipeline (page SGDF, justificatifs fictifs, signatures PAdES) via vitest, car le code utilise l'alias `@/`. Les dates et le dossier de preuve des PDF sont figés au moment de la génération.

## Classer chaque route API

`src/lib/demo/routes.ts` classe chaque route de `src/app/api/` dans `ROUTES_AUTORISEES_DEMO` ou `ROUTES_BLOQUEES_DEMO` (avec des méthodes précises si besoin). Le test `src/_tests_/demo-routes.test.ts` lit le système de fichiers et échoue si une route n'est dans aucune liste : **toute nouvelle route API impose une décision**. Les routes natives de Better Auth sont en liste blanche (`ROUTES_AUTH_AUTORISEES_DEMO`) : seul ce que l'interface utilise est permis, tout le reste (inscription, connexion, mot de passe, organisation) est bloqué. Les gardes qui dépendent du corps ou de l'identité sont dans les handlers, car le proxy ne les voit pas.

## Données personnelles

- Rien de réel n'est attendu : la page `/demo` demande de ne pas saisir de vraies données.
- Les adresses semées sont en `@demo.invalid`. Le seul vrai identifiant conservé est l'IP hachée (HMAC, secret propre à la démo), supprimée avec le bac à sable au bout de 24 heures.
- Umami est utilisé sans cookie, avec un identifiant de site distinct de la production (événements `demo-lancee` et `demo-creer-vrai-groupe`).

## Journalisation

Les événements de la catégorie `demo` (`demo.bac_a_sable_cree`, `demo.purge`, `demo.mail_capture`, `demo.mail_sans_bac_a_sable`) ne contiennent aucune donnée personnelle.

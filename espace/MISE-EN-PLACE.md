# Espace client Coup de Com’ : mise en place

Une seule fois, environ 30 minutes. Ensuite, tout se gère depuis la page `coupdecommunication.com/espace/`.

Tant que les étapes 1 à 3 ne sont pas faites, la page affiche « Votre espace arrive ».

## Ce que contient le dossier

| Fichier | À quoi il sert |
|---|---|
| `espace/index.html`, `espace/app.js`, `espace/logo.svg` | La page de l’espace client (vue client et vue gestion) |
| `espace/config.js` | L’adresse de ta base et ta clé publique : la seule chose à remplir |
| `espace/schema.sql` | Le script qui crée la base et toutes les règles de sécurité |
| `.github/workflows/supabase-eveil.yml` | Une petite tâche automatique qui empêche la base de s’endormir |
| `demo-espace-client-coupdecom.html` | La démo avec de fausses données (à ne pas mettre en ligne) |

## 1. Créer la base (Supabase)

1. Va sur **supabase.com** et crée un compte (gratuit), idéalement avec `coupdecommunication@gmail.com`.
2. **New project** :
   - nom : `coupdecom-espace` ;
   - mot de passe de la base : clique sur « Generate » et garde-le dans ton gestionnaire de mots de passe (il ne sert pas au site) ;
   - région : **West EU (Paris)**.
3. Clique sur **Create new project** et attends 1 à 2 minutes.

## 2. Installer les tables et les règles de sécurité

1. Menu de gauche : **SQL Editor** › **New query**.
2. Ouvre `espace/schema.sql`, copie **tout**, colle-le dans la fenêtre, puis clique sur **Run**.
3. Message attendu : « Success. No rows returned ».

Le script peut être relancé sans risque : il n’efface rien. Il inscrit déjà les deux adresses admin, `coupdecommunication@gmail.com` et `admproduction06@gmail.com`.

## 3. Brancher la page à la base

1. **Project Settings** (roue crantée) › **API Keys**.
2. Copie la **Project URL** (elle ressemble à `https://abcdxyz.supabase.co`) et la clé **Publishable** (elle commence par `sb_publishable_`). Selon l’écran, cette clé peut s’appeler **anon public**.
3. Ouvre `espace/config.js` et remplace les deux valeurs (ou donne-les à Claude, qui le fera).

La clé publishable est faite pour être visible : la sécurité est dans les règles de la base. **Ne mets jamais la clé « secret » ou « service_role »** dans le site, et ne la donne à personne.

## 4. Autoriser l’adresse de l’espace

**Authentication** › **URL Configuration** :

- **Site URL** : `https://coupdecommunication.com/espace/`
- **Redirect URLs** (bouton « Add URL », une par ligne) :
  - `https://coupdecommunication.com/espace/`
  - `https://www.coupdecommunication.com/espace/`
  - l’adresse Cloudflare de ton site suivie de `/espace/` (elle finit par `.pages.dev`, tu la trouves dans Cloudflare › Workers & Pages › ton projet)

Sans cette étape, le lien reçu par e-mail ne ramène pas sur l’espace.

## 5. Les e-mails de connexion en français

**Authentication** › **Emails** › **Templates**.

Modèles **Magic Link** puis **Confirm signup** (le même pour les deux) :

- Sujet : `Votre lien de connexion · Coup de Com’`
- Contenu : efface tout et colle le contenu du fichier `emails/modele-magic-link.html` (ouvre-le avec un éditeur de texte, pas avec un navigateur). Il reprend ta charte : logo, crème, forêt, bouton terracotta, code de connexion sur fond pêche.
- Le logo de l'e-mail est l'image `espace/email-logo.png` du site : elle s'affiche dès que l'espace est en ligne.

Les e-mails restent au vouvoiement pour tout le monde (Supabase ne sait pas quel client préfère le tutoiement). La page, elle, tutoie les clients que tu as réglés sur « Tutoiement ».

## 6. Envoyer les e-mails par ta boîte Gmail (important)

L’envoi intégré de Supabase est limité à quelques e-mails par heure : bien pour tester, pas pour de vrais clients.

1. Compte Google de `coupdecommunication@gmail.com` › **Sécurité** › active la **Validation en deux étapes** si ce n’est pas fait.
2. Toujours dans Sécurité : **Mots de passe des applications** › crée-en un nommé « Supabase ». Google affiche 16 lettres : copie-les.
3. Dans Supabase : **Authentication** › **Emails** › **SMTP Settings** › active **Enable custom SMTP** :
   - Sender email : `coupdecommunication@gmail.com`
   - Sender name : `Coup de Com’`
   - Host : `smtp.gmail.com`
   - Port : `587`
   - Username : `coupdecommunication@gmail.com`
   - Password : les 16 lettres du mot de passe d’application
4. **Save**.

Tu saisis ce mot de passe toi-même dans Supabase : ne le donne à personne, pas même à Claude. Plus tard, quand tu auras une adresse sur ton domaine (`contact@coupdecommunication.com`), tu pourras passer par Brevo de la même façon.

## 7. Mettre l’espace en ligne

Ton site est déjà relié à Cloudflare : chaque envoi sur GitHub le remet en ligne tout seul.

1. Ouvre ton dépôt GitHub `coupdecommunication-ui/coupdecommunication`.
2. **Add file** › **Upload files** : glisse le dossier `espace` entier (avec `config.js` rempli), puis **Commit changes**.
3. Fais de même pour le fichier `.github/workflows/supabase-eveil.yml`, en gardant exactement ce chemin. Sur GitHub, le plus simple : **Add file** › **Create new file**, tape `.github/workflows/supabase-eveil.yml` comme nom, colle le contenu, **Commit changes**.
4. Attends une minute, puis ouvre `https://coupdecommunication.com/espace/`.

Tu peux aussi demander à Claude de faire l’envoi : il lui faut alors l’accès en écriture au dépôt.

N’envoie pas `demo-espace-client-coupdecom.html` sur le site : c’est seulement pour tester.

## 8. Empêcher la base de s’endormir

L’offre gratuite de Supabase met la base en pause après 7 jours sans visite. La tâche automatique installée à l’étape 7 fait une petite lecture tous les 3 jours. Il faut juste lui donner l’adresse et la clé :

1. Dépôt GitHub › **Settings** › **Secrets and variables** › **Actions** › **New repository secret**.
2. Nom `SUPABASE_URL`, valeur : ta Project URL. **Add secret**.
3. Nom `SUPABASE_KEY`, valeur : ta clé publishable. **Add secret**.
4. Onglet **Actions** › « Supabase éveillé » › **Run workflow** pour tester : une coche verte doit apparaître.

GitHub suspend les tâches automatiques d’un dépôt resté 60 jours sans aucun changement : il t’enverra un e-mail, il suffit alors de cliquer sur « Enable workflow ».

## 9. Être prévenue quand un client répond (facultatif, conseillé)

1. Va sur **web3forms.com**, saisis `coupdecommunication@gmail.com`, tu reçois une **clé d’accès** par e-mail.
2. Colle-la dans `espace/config.js`, à la ligne `notifyKey`.

Tu reçois alors un e-mail quand un client valide un post ou demande une modification, accepte un devis, envoie son brief, ou quand un prospect envoie son questionnaire de découverte.

## 10. Premier essai

1. Ouvre `coupdecommunication.com/espace/`, saisis `coupdecommunication@gmail.com`, clique sur le lien reçu : tu arrives sur la **gestion**.
2. Sur la page de la liste, remplis **Coordonnées de paiement** (titulaire, IBAN, BIC, banque, lien Revolut si tu en as un). Ces informations ne sont visibles que des gérants et de la compta de tes clients.
3. Dans « Ton accès », crée un mot de passe : tu pourras te connecter sans attendre l’e-mail.
4. **Nouveau projet** › mets une autre de tes adresses comme « Gérant », copie l’invitation, connecte-toi avec cette adresse dans une fenêtre de navigation privée : tu vois exactement ce que verra ton client.

## Utilisation au quotidien

**Un prospect, avant la signature**
Après le premier appel : **Nouveau prospect** › nom de l’établissement › **Accès client** : son adresse › **Copier l’invitation** (le message est adapté : « Merci pour notre échange… »).
Le prospect ne voit que son questionnaire de découverte : son établissement, ce qui l’intéresse, ses objectifs, sa vision, son budget, ses délais. Il peut aussi enregistrer des messages vocaux depuis son téléphone et déposer ses logos, photos et documents. Tu reçois un e-mail quand il l’envoie (si Web3Forms est branché).
Si tu lui ajoutes un devis, il le voit sous « Notre proposition » et peut l’accepter d’un clic.
Quand il signe : bouton **Passer en client signé**. Tout son espace s’ouvre (posts, calendrier, rapports, factures), ses réponses, fichiers et messages vocaux sont conservés, et son brief est rouvert pour qu’il complète les infos de démarrage (accès Meta, personne qui valide les posts…).
Le micro demande l’autorisation du navigateur. Si le client refuse ou si son navigateur ne sait pas enregistrer, il peut toujours écrire ou dicter avec le micro de son clavier.

**Un nouveau client**
**Nouveau projet** › nom du client, ton (vouvoiement ou tutoiement), délai de validation (48 h par défaut) › **Accès client** : ajoute chaque personne avec son rôle › **Copier l’invitation** › envoie-la par WhatsApp ou e-mail.

| Rôle | Ce qu’il voit et peut faire |
|---|---|
| Gérant | Tout : valide les posts, accepte les devis, voit les factures |
| Équipe | Posts, calendrier, rapports, brief, livrables. Rien de financier |
| Compta | Devis et factures uniquement |

**Les posts du mois**
1. **Nouveau post** › date, réseaux, format, titre, légende, visuels (glisse-les sur le post ouvert).
2. Un post reste en **brouillon**, invisible pour le client, tant que tu ne cliques pas sur **Envoyer au client pour validation**.
3. Le client valide, ou pose des repères sur l’image avec ses remarques.
4. Pour une demande de modification : corrige, puis **Envoyer la version corrigée** (le délai repart de zéro).
5. Sans réponse à la fin du délai, le post est **validé automatiquement** : la base refuse ensuite les réponses. Le bouton **Copier un rappel** prépare un message à envoyer avant la fin du délai.
6. Une fois en ligne : **Marquer publié**.

**Le rapport du mois**
- À la main : **Rapports** › **Ajouter un mois** › remplis les chiffres de chaque réseau.
- Ou depuis Metricool : Analytique › choisis le réseau et le mois › bouton d’export › CSV. Puis **Importer un fichier CSV** › choisis le réseau › vérifie les colonnes devinées › **Importer**. Un fichier par réseau. L’import remplace seulement les chiffres des mois présents dans le fichier.
- Ajoute les 3 meilleurs posts et ton commentaire : c’est ce que le client lit en premier.

**Branding (logo, charte)**
**Livrables et livraison** › **Ajouter un livrable** › choisis le fichier final. Si c’est une image, l’aperçu avec le filigrane « Coup de Com’ · Aperçu » se crée tout seul. Pour un PDF ou un ZIP, ajoute une image d’aperçu. Le client voit l’aperçu tout de suite ; le fichier final ne s’ouvre qu’une fois toutes les factures en « Payée ». C’est la base qui le vérifie.

**Devis et factures**
Ajoute le PDF, le montant et les dates. Le gérant accepte un devis d’un clic : la date et son adresse sont enregistrées. Quand tu reçois un paiement, passe la facture en « Payée ».

## Bon à savoir

- **Offre gratuite Supabase** : 1 Go de fichiers au total et 50 Mo par fichier. Pour une vidéo plus lourde, mets un lien (Drive, WeTransfer) dans le post.
- **Ajouter ou retirer un admin** : dans `espace/config.js` (ligne `adminEmails`) **et** dans la base (SQL Editor : `insert into admins(email) values ('adresse@exemple.fr');`). Les deux sont nécessaires.
- **Archiver** un projet terminé le cache au client sans rien effacer.
- **Mots de passe des réseaux** : l’espace ne les demande jamais. Le brief invite le client à donner l’accès dans Meta Business Suite.

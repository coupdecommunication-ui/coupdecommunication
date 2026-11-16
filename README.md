# Site Coup de Com' — coupdecommunication.com

Site vitrine de Coup de Com' (communication digitale & visuelle).
C'est un site « statique » : de simples fichiers, sans base de données. Tout est dans ce dépôt.

## Ce qu'il y a dans le dossier

| Élément | Rôle |
|---|---|
| `index.html` | Tout le site : textes, mise en page, animations |
| `assets/` | Images, vidéos, logo |
| `fonts/` | Polices de la charte (Fraunces, Outfit, Cormorant) |
| `vendor/` | Bibliothèques d'animation (GSAP, Lenis, Three.js), copiées ici pour que le site ne dépende d'aucun service extérieur |
| `robots.txt`, `sitemap.xml` | Pour Google |
| `404.html` | Page de secours qui renvoie à l'accueil |

## Modifier un texte, un prix ou un avis (sans rien installer)

1. Sur GitHub, ouvre `index.html` et clique sur le crayon (« Edit this file »).
2. Fais `Ctrl + F` (ou `Cmd + F` sur Mac) et cherche **À MODIFIER FACILEMENT**. Tu y trouves :
   - `CONTACT` : l'email et le téléphone ;
   - `TARIFS` : les prix « à partir de » des packs et de l'audit ;
   - `UNITES` : les prestations à l'unité et leurs prix ;
   - `AVIS` : les avis clients. Ajoute une ligne par avis, par exemple
     `{ nom:"Prénom N.", etab:"Nom du lieu", note:5, texte:"Le texte de l'avis." },`
   - `WORKS` : la liste des réalisations (petits carrés).
3. Pour un autre texte, cherche simplement la phrase avec `Ctrl + F` et modifie-la.
4. Clique sur **Commit changes**. Cloudflare remet le site en ligne tout seul en une ou deux minutes.

Attention à ne pas effacer les guillemets `"` ni les virgules autour de ce que tu modifies.

## Ajouter une image

1. Prépare l'image en `.webp` ou `.jpg` (largeur 1200 px maximum, c'est suffisant).
2. Dans le dossier `assets/` sur GitHub : **Add file › Upload files**.
3. Ajoute-la dans la liste `WORKS` d'`index.html`, avec son nom sans l'extension.

## Hébergement

- Hébergé sur **Cloudflare Pages**, relié à ce dépôt : chaque modification de la branche `main` est remise en ligne automatiquement.
- Nom de domaine : `coupdecommunication.com`, à renouveler chaque année.
- Accès à garder précieusement : compte GitHub, compte Cloudflare, compte du fournisseur du domaine.

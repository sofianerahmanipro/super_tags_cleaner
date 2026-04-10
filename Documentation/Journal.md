# Super Tags Cleaner — Journal de bord

> Documentation technique et retour d'expérience sur la conception d'un outil de nettoyage de fichiers Word pour les tags Dendreo.
> Par un CSM Care qui a décidé de coder son propre outil.

---

## Sommaire

1. [Le problème de départ](#le-problème-de-départ)
2. [Ce qu'est réellement un fichier .docx](#ce-quest-réellement-un-fichier-docx)
3. [Comment Word casse nos tags](#comment-word-casse-nos-tags)
4. [Premiers essais et erreurs](#premiers-essais-et-erreurs)
5. [L'architecture finale du moteur de nettoyage](#larchitecture-finale-du-moteur-de-nettoyage)
6. [La regex : un monstre apprivoisé](#la-regex--un-monstre-apprivoisé)
7. [Les pièges du XML Word](#les-pièges-du-xml-word)
8. [Clean My Syntaxe : l'analyseur de syntaxe](#clean-my-syntaxe--lanalyseur-de-syntaxe)
9. [Bugs mémorables et leçons apprises](#bugs-mémorables-et-leçons-apprises)
10. [Stack technique et choix d'architecture](#stack-technique-et-choix-darchitecture)
11. [Ce que j'aurais aimé savoir dès le début](#ce-que-jaurais-aimé-savoir-dès-le-début)
12. [Glossaire pour les non-devs](#glossaire-pour-les-non-devs)

---

## Le problème de départ

Je suis CSM Care pour Dendreo, un ERP SaaS destiné aux organismes de formation. Dendreo propose un système de **tags** (des marqueurs entre accolades comme `{adf_intitule}`) que nos clients insèrent dans des modèles Word. Quand le document est importé dans Dendreo, le logiciel remplace ces tags par les vraies données : nom du stagiaire, date de la session, intitulé de la formation, etc.

Le problème ? **Word casse nos tags.** Pas méchamment, pas volontairement. Mais il le fait, systématiquement, dès qu'on touche au formatage ou qu'on corrige une faute. Et quand un tag est cassé, Dendreo ne le reconnaît plus. Le document généré affiche le tag brut ou rien au lieu des données. Le client nous contacte, on ouvre le fichier, on voit le tag cassé, on le tape ailleurs ou on le va le copier pour le recoller dans le doc... et on recommence la semaine suivante.

Après avoir fait ça des dizaines de fois, j'ai décidé de créer un outil pour automatiser la correction. C'est comme ça qu'est né **Super Tags Cleaner** 🚀

---

## Ce qu'est réellement un fichier .docx

C'est la première chose que j'ai dû apprendre, et honnêtement, ça a été une révélation.

**Un fichier .docx n'est pas un fichier texte.** C'est une **archive ZIP** qui contient des fichiers XML. Si vous renommez `document.docx` en `document.zip` et que vous le décompressez, voici ce que vous trouvez :

```
document.zip/
├── [Content_Types].xml          ← Décrit les types de fichiers contenus
├── _rels/
│   └── .rels                    ← Relations entre les fichiers
├── word/
│   ├── document.xml             ← LE contenu principal du document
│   ├── styles.xml               ← Les styles (titres, police, etc.)
│   ├── header1.xml              ← En-tête de page
│   ├── footer1.xml              ← Pied de page
│   ├── numbering.xml            ← Listes numérotées et à puces
│   ├── settings.xml             ← Paramètres du document
│   ├── media/                   ← Images, logos, etc.
│   └── _rels/
│       └── document.xml.rels    ← Relations du document principal
└── docProps/
    ├── app.xml                  ← Métadonnées (auteur, dates...)
    └── core.xml
```

Le fichier qui nous intéresse le plus est `word/document.xml`. C'est là que vivent nos tags. Mais attention : les tags peuvent aussi se trouver dans `header1.xml`, `footer1.xml`, ou n'importe quel autre fichier XML du dossier `word/`. Notre outil doit donc tous les scanner.

### Comment le texte est structuré dans le XML

Dans le XML Word (format Open XML), le texte est organisé en trois niveaux :

- **`<w:p>`** : un paragraphe
- **`<w:r>`** : un "run" (un segment de texte avec un formatage uniforme)
- **`<w:t>`** : le texte brut à l'intérieur du run

Un paragraphe simple comme « Hello World! » ressemble à ça en XML :

```xml
<w:p>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/>
    </w:rPr>
    <w:t>Hello World!</w:t>
  </w:r>
</w:p>
```

`<w:rPr>` contient les propriétés de formatage du run (police, taille, gras, italique...). Quand tout le texte a le même formatage, tout tient dans un seul `<w:r>`. Mais dès que le formatage change, Word crée un nouveau run.

---

## Comment Word casse nos tags

Voilà le cœur du problème. Prenons le tag `{adf_liste_complete_formateurs_simple}`. Pour nous, c'est une seule unité. Pour Word, c'est juste du texte. Et Word a ses propres raisons de découper ce texte en morceaux.

### Pourquoi Word découpe-t-il le texte ?

Plusieurs raisons que j'ai identifiées au fil du temps :

1. **Le correcteur orthographique.** Word ne reconnaît pas `adf_liste_complete_formateurs_simple` comme un mot. Il le considère comme une faute. Et quand il le signale, il insère des balises `<w:proofErr>` qui fragmentent le texte en plusieurs runs.

2. **Les modifications successives.** Chaque session d'édition dans Word est identifiée par un "revision ID" (`w:rsidR`). Si vous tapez `{adf_` le lundi, puis `liste}` le mardi, Word crée deux runs distincts parce qu'ils appartiennent à deux sessions d'édition différentes.

3. **Le formatage partiel.** Si par accident on sélectionne une partie du tag et qu'on change la police ou la taille, Word découpe le run à cet endroit.

4. **Le copier-coller.** Coller du texte depuis une autre source peut introduire des runs avec des propriétés de formatage différentes.

### Exemple concret

Voici ce que ça donne quand Word a cassé le tag `{adf_liste_complete_formateurs_simple}` :

```xml
<w:r w:rsidRPr="00B12CC7">
  <w:rPr>
    <w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/>
  </w:rPr>
  <w:t> : {adf_</w:t>
</w:r>
<w:r w:rsidRPr="00B12CC7">
  <w:rPr>
    <w:rStyle w:val="indicationsCar"/>
    <w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/>
    <w:sz w:val="16"/>
    <w:szCs w:val="16"/>
  </w:rPr>
  <w:t>liste</w:t>
</w:r>
<w:r w:rsidRPr="00B12CC7">
  <w:rPr>
    <w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/>
  </w:rPr>
  <w:t>_complete_formateurs_simple}</w:t>
</w:r>
```

Trois `<w:r>` différents au lieu d'un seul. Le tag est littéralement **éparpillé** dans le XML. Quand Dendreo lit le document, il cherche un tag complet dans un seul `<w:t>` (je pense. J'ai pas le code de Ddo sous les yeux donc je ne peux qu'imaginer mdr). Il trouve ` : {adf_`, puis `liste`, puis `_complete_formateurs_simple}`. Aucun ne correspond à un tag valide. Résultat : le tag est ignoré et le texte brut (ou un vide) apparaît dans le document final. Voire une erreur apparait lors de la génération du PDF.

---

## Premiers essais et erreurs

### Essai 1 — Le parseur DOM (échec critique)

Mon premier réflexe a été d'utiliser un parseur XML (DOMParser en JavaScript, xml2js en Node). L'idée : parser le XML, manipuler l'arbre DOM, reconstruire le fichier.

**C'était une très mauvaise idée.** (en même temps j'y suis aller au pif sur ce coup là, bref...)

Le parseur DOM fait des choses « intelligentes » qui détruisent le fichier Word :

- Il **réordonne les attributs** XML (l'ordre des attributs n'a pas d'importance en théorie, mais Word est très strict)
- Il **supprime les déclarations de namespace** qu'il juge inutilisées
- Il **modifie le formatage** du XML (espaces, indentation, retours à la ligne)
- Il **ré-encode certains caractères** différemment

Résultat : le fichier .docx obtenu après recompression était **corrompu**. Word refusait de l'ouvrir ou affichait un message d'erreur de récupération. Même quand il arrivait à l'ouvrir, des morceaux de mise en page avaient disparu.

**Leçon apprise : ne jamais utiliser de parseur DOM pour modifier du XML Word.** Il faut travailler sur le **texte brut** du XML, avec des regex et des remplacements de chaînes.

### Essai 2 — Recherche et remplacement naïf (échec partiel)

Deuxième approche : travailler sur le texte brut du XML entier. Chercher les motifs de tags cassés et les remplacer. Simple, non ?

Le problème : comment identifier un tag cassé dans un flux XML ? Un tag cassé, c'est un `{` dans un `<w:t>`, suivi de texte dans d'autres `<w:t>` de `<w:r>` différents, avec un `}` quelque part plus loin. Entre les deux, il y a tout le balisage XML des runs intermédiaires. Impossible de faire un simple find-and-replace sur le fichier entier.

**Leçon apprise : il faut travailler paragraphe par paragraphe.** Un tag ne traverse jamais les frontières d'un paragraphe `<w:p>`. C'est une contrainte du format Dendreo et de Word.

### Essai 3 — L'approche par paragraphe (succès)

L'idée qui a fonctionné :

1. Découper le XML en paragraphes (`<w:p>...</w:p>`)
2. Pour chaque paragraphe, extraire tous les runs et concaténer leur texte
3. Chercher les tags Dendreo dans le texte concaténé
4. Si un tag s'étend sur plusieurs runs, fusionner ces runs
5. Reconstruire le paragraphe avec les runs modifiés

C'est cette approche qui est devenue le cœur de l'application.

---

## L'architecture finale du moteur de nettoyage

### Le flux complet

```
Fichier .docx (glissé-déposé par l'utilisateur)
    ↓
JSZip.loadAsync(file)              → Décompression en mémoire dans le navigateur
    ↓
Pour chaque fichier word/*.xml     → Lecture du contenu texte brut
    ↓
cleanBrokenTags(xmlContent)        → Nettoyage paragraphe par paragraphe
    ↓
JSZip.generateAsync("blob")       → Recompression en .docx
    ↓
saveAs(blob, "nom_fixed.docx")    → Téléchargement du fichier corrigé
```

Tout se passe **dans le navigateur**. Aucun fichier n'est envoyé à un serveur (économies la team ! 😜). C'était une exigence forte : les documents de nos clients contiennent des données sensibles (contrats, factures, données personnelles). Hors de question de les faire transiter par un serveur (Puis faire du DevOps ça me gave donc double flemme !).

### L'algorithme de nettoyage, étape par étape

Voici comment fonctionne la fonction `fixTagsInParagraph`, la plus critique de tout le projet :

**Étape 1 — Extraction des runs.** On parcourt le XML du paragraphe et on extrait chaque `<w:r>` avec son contenu textuel (le texte dans `<w:t>`). On note aussi les éléments intermédiaires comme `<w:proofErr>` (marques du correcteur orthographique) et `<w:bookmarkStart>` (signets). Pour chaque run, on stocke sa position exacte dans le XML et la position de son texte dans la concaténation globale.

**Étape 2 — Concaténation du texte.** On colle bout à bout tout le texte extrait des runs. Ça nous donne le texte « propre » du paragraphe, sans XML. Par exemple : ` : {adf_liste_complete_formateurs_simple}`.

**Étape 3 — Détection des tags.** On applique la regex des tags Dendreo sur le texte concaténé. On obtient la liste de tous les tags avec leur position (début, fin) dans le texte concaténé.

**Étape 4 — Mapping texte → runs.** Pour chaque tag détecté, on regarde quels runs il couvre. Si le tag commence dans le run 2 et finit dans le run 4, alors le tag est cassé sur 3 runs (2, 3 et 4).

**Étape 5 — Fusion.** Pour chaque tag cassé, on fusionne les runs. Le texte complet du tag est placé dans le `<w:t>` du premier run concerné. Les runs intermédiaires qui ne contenaient que des fragments du tag sont supprimés. Les `<w:proofErr>` entre les runs fusionnés sont également supprimés.

**Étape 6 — Reconstruction.** On reconstruit le XML du paragraphe en remplaçant les éléments modifiés et en supprimant les éléments marqués pour suppression.

### Le cas épineux du run partagé

Le cas le plus complexe à gérer : un seul `<w:r>` contient la **fin** d'un tag ET le **début** d'un autre.

Exemple : `<w:t>}, le {</w:t>`

Ce run contient :

- `}` → fin du tag précédent (par exemple `{conf_of_ville}`)
- `, le ` → du texte normal
- `{` → début du tag suivant (par exemple `{g_date_edition_texte}`)

Ce run ne peut pas être simplement supprimé. Il faut le conserver et n'en retirer que les parties qui appartiennent aux tags fusionnés, en gardant le texte intermédiaire. C'est là que l'algorithme devient délicat et qu'il faut être très précis dans le mapping des positions.

---

## La regex : un monstre apprivoisé (Merci l'IA)

La regex de détection des tags Dendreo a été l'un des éléments les plus délicats à mettre au point. Elle doit matcher tous les types de tags valides sans capturer de faux positifs.

### Les types de tags Dendreo

| Type                  | Syntaxe               | Exemple                      |
| --------------------- | --------------------- | ---------------------------- |
| Simple                | `{nom}`               | `{adf_intitule}`             |
| Boucle ouvrante       | `{#nom}`              | `{#adf_jours}`               |
| Boucle fermante       | `{/nom}`              | `{/adf_jours}`               |
| Boucle tableau        | `{##nom}`             | `{##adf_jours}`              |
| Condition ouvrante    | `{?nom=valeur}`       | `{?adf_type=INTER}`          |
| Condition fermante    | `{/nom}`              | `{/adf_type}`                |
| Boucle conditionnelle | `{#nom:champ=valeur}` | `{#participants:heures>0}`   |
| Avec compteur         | `{#nom,i:champ>0}`    | `{#participants,i:heures>0}` |

### Les opérateurs supportés

`=`, `==`, `!=`, `<>`, `>`, `>=`, `<`, `<=`

Et dans les valeurs, des syntaxes spéciales : intervalles `[80;100]`, wildcards `*BTP*`, OU logique `A|B`, ET logique `A+B`, guillemets `"E-learning"`.

### Le piège des opérateurs multi-caractères

C'est un bug qui m'a coûté des heures. Si dans la regex on liste les opérateurs dans cet ordre : `=`, `>`, `>=`, `<`, `<=`... la regex matche `=` dans `>=` avant de pouvoir matcher `>=`. Résultat : le tag `{?tag>=0}` est interprété comme `{?tag>` suivi de `=0}` qui ne correspond à rien.

**La solution est simple mais il faut y penser :** toujours lister les opérateurs à 2 caractères AVANT ceux à 1 caractère dans la regex :

```
(?:>=|<=|<>|!=|==|>|<|=)
```

### La regex finale

```javascript
const TAG_PATTERN =
  /\{[#]{0,2}[?/]?[a-z][a-z0-9_]*(?:,[a-z])?(?::[a-z][a-z0-9_]*)?(?:(?:>=|<=|<>|!=|==|>|<|=)[^}]*)?\}/g;
```

Décomposition :

- `\{` → accolade ouvrante
- `[#]{0,2}` → zéro, un ou deux `#` (simple, boucle, boucle tableau)
- `[?/]?` → optionnellement `?` (condition) ou `/` (fermant)
- `[a-z][a-z0-9_]*` → le nom du tag (commence par une lettre minuscule)
- `(?:,[a-z])?` → optionnellement un compteur (`,i`)
- `(?::[a-z][a-z0-9_]*)?` → optionnellement un sous-champ (`:intitule`)
- `(?:(?:>=|<=|<>|!=|==|>|<|=)[^}]*)?` → optionnellement un opérateur suivi d'une valeur
- `\}` → accolade fermante

---

## Les pièges du XML Word

### Les entités HTML dans le texte

Dans le XML Word, certains caractères dans le `<w:t>` sont encodés en entités :

- `<` → `&lt;` (toujours)
- `&` → `&amp;` (toujours)
- `>` → `&gt;` (parfois, pas toujours - c'est incohérent)

Ça pose un problème concret. Le tag `{?heures>=10}` peut apparaître dans le XML comme :

```xml
<w:t>{?heures&gt;=10}</w:t>
```

Quand on extrait le texte pour chercher les tags, il faut **décoder** ces entités. Et quand on réécrit le texte dans le `<w:t>`, il faut **ré-encoder** `<` et `&` (mais pas forcément `>`).

J'ai perdu une après-midi entière à debugger un cas où un tag avec `>=` n'était pas détecté. La raison : le `>` était encodé en `&gt;` dans le XML, et ma regex cherchait un `>` littéral.

### L'attribut `xml:space="preserve"`

Un autre piège subtil. Dans le XML Word, si le texte d'un `<w:t>` commence ou finit par un espace, Word ne le conserve **que** si l'attribut `xml:space="preserve"` est présent :

```xml
<!-- L'espace au début sera conservé -->
<w:t xml:space="preserve"> Bonjour</w:t>

<!-- L'espace au début sera IGNORÉ par Word -->
<w:t> Bonjour</w:t>
```

Quand on fusionne des runs, le texte résultant peut commencer ou finir par un espace (par exemple si le texte original était ` : {adf_intitule}`). Il faut penser à ajouter `xml:space="preserve"` dans ce cas, sinon l'espace disparaît et la mise en page est cassée.

### Les `<w:proofErr>` et autres éléments parasites

Entre les `<w:r>`, Word insère parfois des éléments qui ne contiennent pas de texte mais qui fragmentent la structure :

- `<w:proofErr w:type="spellStart"/>` et `<w:proofErr w:type="spellEnd"/>` → marques du correcteur orthographique
- `<w:bookmarkStart>` et `<w:bookmarkEnd>` → signets
- `<w:commentRangeStart>` et `<w:commentRangeEnd>` → commentaires

Quand on fusionne des runs, il faut aussi supprimer les `<w:proofErr>` qui se trouvaient entre les runs fusionnés, sinon Word peut avoir un comportement inattendu.

### Les positions se décalent après chaque modification

Si on traite les tags cassés un par un en modifiant le XML au fur et à mesure, les positions de tous les tags suivants sont décalées (parce qu'on a ajouté ou retiré des caractères). J'ai eu un bug vicieux où le deuxième tag d'un paragraphe était systématiquement mal nettoyé parce que ses positions étaient calculées sur le XML original, pas sur le XML modifié.

**Solution :** traiter tous les tags en une seule passe. Soit en partant de la fin vers le début (les positions des tags précédents restent valides), soit en reconstruisant tout le paragraphe d'un coup à partir d'une liste de modifications planifiées.

---

## Clean My Syntaxe : l'analyseur de syntaxe

### L'idée

Après avoir créé l'outil de nettoyage XML (Clean My Tags), j'ai réalisé qu'un autre problème revenait souvent : les **erreurs de syntaxe** dans les tags eux-mêmes. Pas des problèmes de XML cassé, mais des erreurs humaines :

- Un espace qui s'est glissé dans le nom du tag : `{participant_ nom}`
- Un accent oublié : `{participant_prénom}` (les noms de tags Dendreo n'acceptent pas les accents)
- Une majuscule : `{Participant_Nom}`
- Une boucle ouverte jamais fermée : `{#adf_jours}` sans `{/adf_jours}`
- Des boucles mal imbriquées

J'ai donc ajouté une seconde fonctionnalité : **Clean My Syntaxe**. Contrairement à Clean My Tags qui modifie le fichier, celle-ci est en **lecture seule**. Elle analyse le document et affiche un rapport d'erreurs avec des messages explicatifs.

### L'extraction des tags

Pour analyser la syntaxe, il faut d'abord extraire tous les tags du document. L'approche est la même que pour Clean My Tags : décompresser le .docx, parcourir les fichiers XML, concaténer le texte des `<w:t>`, et chercher les tags avec une regex.

Mais ici, la regex est **plus permissive**. On veut capturer les tags même s'ils sont malformés, justement pour pouvoir signaler les erreurs. La regex stricte de Clean My Tags rejetterait `{Participant_Nom}` (majuscules) ou `{participant_ nom}` (espace). La regex permissive de Clean My Syntaxe les capture pour les analyser.

```javascript
// Regex permissive pour Clean My Syntaxe
const PERMISSIVE_TAG_PATTERN = /\{[#]{0,2}[?/]?[^}]+\}/g;
```

### Les 12 règles de validation

J'ai implémenté 12 règles de validation couvrant les erreurs les plus courantes. Chaque règle produit un message en français, pensé pour être compréhensible par nos CSM (qui ne sont pas développeurs).

Les règles se divisent en deux catégories :

**Les vérifications individuelles** (par tag isolé) :

- Espace dans le nom du tag
- Accent dans le nom du tag
- Majuscule dans le nom du tag
- Tag vide (`{}`)
- Opérateur invalide
- Boucle conditionnelle ambiguë (sans opérateur sur le sous-champ)
- Accolade non fermée

**Les vérifications structurelles** (relations entre tags) :

- Boucle non fermée
- Condition non fermée
- Tag fermant orphelin
- Croisement de boucles/conditions (mauvaise imbrication)
- Boucle de tableau avec un tag fermant en trop

### L'algorithme de pile pour vérifier l'imbrication

Les vérifications structurelles utilisent un algorithme classique de **pile** (stack). L'idée :

1. On parcourt les tags dans l'ordre du document
2. Quand on rencontre un tag ouvrant (`{#...}` ou `{?...}`), on l'empile
3. Quand on rencontre un tag fermant (`{/...}`), on vérifie que le sommet de la pile correspond
4. Si ça correspond, on dépile (tout va bien)
5. Si ça ne correspond pas, il y a un problème (croisement ou orphelin)
6. À la fin, tout ce qui reste dans la pile correspond à des tags ouvrants jamais fermés

Les boucles de tableau (`{##...}`) sont un cas particulier : elles n'ont **pas de tag fermant**. Elles ne doivent donc pas être empilées.

### Le problème des tags fermants ambigus

Un `{/adf_jours}` peut fermer soit une boucle `{#adf_jours}` soit une condition `{?adf_jours=...}`. On ne peut pas savoir lequel en regardant le tag fermant seul. C'est l'algorithme de pile qui détermine le type en regardant quel tag ouvrant est en haut de la pile.

---

## Bugs mémorables et leçons apprises

### Bug 1 — Le faux croisement qui n'en était pas un

C'est le bug qui m'a le plus fait tourner en rond. Le rapport d'erreurs affichait :

> La condition {?adf_type=INTRA} et la boucle {/adf_recettes_annexes} se croisent.

Mais en regardant le document, l'imbrication était correcte. Le vrai problème était un `{/adf_recettes_annexes}` **en trop** dans le document (un tag fermant orphelin). Mon algorithme de pile, quand il trouvait un tag fermant qui ne correspondait pas au sommet de la pile, concluait systématiquement à un croisement. Il ne vérifiait pas si le nom du tag fermant existait réellement dans la pile.

**La correction :** quand un tag fermant ne correspond pas au sommet, **chercher dans toute la pile** avant de conclure. Si le nom n'est trouvé nulle part → c'est un orphelin. Si le nom est trouvé plus profond → c'est un vrai croisement.

### Bug 2 — L'effet cascade du Bug 1

Le Bug 1 ne faisait pas que signaler un faux croisement. Il **corrompait la pile**. L'algorithme dépilait ou modifiait la pile de manière incorrecte, ce qui faisait que tous les tags fermants suivants ne retrouvaient plus leur correspondant. Résultat : un seul tag orphelin générait une cascade de fausses erreurs sur tout le reste du document.

**La leçon cruciale :** quand un orphelin est détecté, la pile ne doit **pas** être modifiée. L'orphelin est juste ignoré côté pile, signalé côté erreurs, et on continue le parcours normalement.

### Bug 3 — "Laquelle des trois boucles ?"

Quand un document contient trois fois `{#adf_jours}` et que le problème est sur la troisième, le message disait simplement « La boucle {#adf_jours} n'est jamais fermée. » L'utilisateur ne savait pas laquelle des trois corriger.

La correction a nécessité deux choses :

1. **Numéroter chaque occurrence** lors de l'extraction (la 1ère, 2ème, 3ème apparition de chaque tag)
2. **Inclure le numéro d'occurrence dans les messages** quand le tag apparaît plus d'une fois : « La 3ᵉ boucle {#adf_jours} n'est jamais fermée. »

### Bug 4 — Le run qui contenait deux tags

J'ai eu un cas où un `<w:r>` contenait `}, le {`. Mon code supprimait ce run entier lors de la fusion du premier tag, et le deuxième tag perdait son `{` initial. Il m'a fallu plusieurs itérations pour gérer proprement ce cas : extraire du run uniquement les caractères qui appartiennent au tag en cours de fusion, et laisser le reste en place.

### Bug 5 — La regex gourmande qui traversait les paragraphes

Ma première regex pour identifier les paragraphes utilisait `<w:p.*>.*</w:p>` avec le flag `s` (dotall). Le problème : le `.*` entre `<w:p>` et `</w:p>` est **gourmand** (greedy). Il matchait du premier `<w:p>` du document au **dernier** `</w:p>`, englobant tous les paragraphes en un seul match.

**La correction :** utiliser `.*?` (non-greedy/lazy) pour que le match s'arrête au premier `</w:p>` rencontré.

---

## Stack technique et choix d'architecture

### Pourquoi une app web et pas un logiciel desktop ?

Le projet initial prévoyait une app desktop en Python avec Flet, compilée via PyInstaller. J'ai finalement basculé vers une app web Next.js pour plusieurs raisons :

- **Pas d'installation.** Nos CSM peuvent utiliser l'outil directement dans leur navigateur.
- **Pas de mise à jour manuelle.** On déploie sur Netlify, tout le monde a la dernière version.
- **Traitement 100% client.** Grâce à JSZip et l'API File du navigateur, tout le traitement se fait localement. Les fichiers ne quittent jamais la machine de l'utilisateur. C'était la condition sine qua non pour que cette approche soit viable côté confidentialité.

### Pourquoi JSZip ?

JSZip est une librairie JavaScript qui permet de créer, lire et modifier des archives ZIP directement dans le navigateur. Comme un .docx est un .zip, JSZip nous permet de :

1. Décompresser le .docx en mémoire
2. Accéder à chaque fichier XML comme une chaîne de caractères
3. Modifier les chaînes (notre nettoyage)
4. Recompresser le tout en .docx

Le tout sans jamais écrire sur le disque de l'utilisateur (sauf le fichier final via le téléchargement).

### Pourquoi pas de parseur DOM pour le XML ?

J'insiste encore une fois là-dessus parce que c'est **la** leçon la plus importante de ce projet. Word est un logiciel qui a 40 ans d'héritage. Son format Open XML est spécifié dans un document de plus de 5 000 pages. Les parseurs XML génériques (DOMParser, xml2js, etc.) sont faits pour du XML « normal ». Le XML de Word est tout sauf normal :

- L'ordre des attributs compte (en pratique, même si la spec XML dit le contraire)
- Les namespaces sont nombreux et interdépendants
- Les déclarations xmlns doivent être préservées exactement telles quelles
- Le formatage du XML (espaces, retours à la ligne) peut avoir un impact sur le rendu

Travailler sur le texte brut avec des regex est moins élégant, mais c'est la seule approche fiable. On ne touche que ce qu'on a besoin de toucher, et on laisse tout le reste exactement tel quel.

### Le design de l'application

L'interface suit un principe simple : dark mode avec des nuances de bleu douces et une couleur d'accent orange. La sidebar à gauche donne accès aux trois pages :

1. **Accueil** — une hero section qui présente les deux fonctionnalités
2. **Clean My Tags** — le nettoyage XML avec drag & drop
3. **Clean My Syntaxe** — l'analyse de syntaxe avec rapport d'erreurs

L'expérience utilisateur est volontairement minimaliste : on glisse un fichier, l'outil fait son travail, et on récupère le résultat. Pas de configuration, pas d'options, pas de comptes utilisateur.

---

## Ce que j'aurais aimé savoir dès le début

En guise de conclusion, voici les choses que j'aurais aimé qu'on me dise avant de me lancer :

1. **Un .docx est un .zip.** Ça paraît évident une fois qu'on le sait, mais c'est la clé de tout.

2. **Ne jamais parser le XML Word avec un DOM.** Travailler sur le texte brut, toujours.

3. **Word fragmente le texte pour mille raisons.** Le correcteur orthographique, les sessions d'édition, le formatage partiel, le copier-coller... Il faut accepter que la fragmentation est la norme, pas l'exception.

4. **Les entités HTML dans les `<w:t>` sont un piège silencieux.** `&gt;`, `&lt;`, `&amp;` doivent être décodés à l'extraction et ré-encodés à la reconstruction.

5. **`xml:space="preserve"` est vital.** Sans cet attribut, les espaces en début et fin de texte disparaissent.

6. **Les opérateurs multi-caractères dans les regex doivent être listés en premier.** `>=` avant `>`, `<=` avant `<`, etc.

7. **Les algorithmes de pile sont puissants mais fragiles.** Un seul cas mal géré (comme un orphelin qui corrompt la pile) peut générer des dizaines de fausses erreurs en cascade.

8. **Tester, tester, tester.** Les cas limites sont nombreux et vicieux. Un tag qui chevauche deux runs, un run qui contient deux tags, trois tags cassés consécutifs... Chaque cas nécessite son propre test unitaire.

9. **Les tags fermants sont ambigus.** `{/nom}` peut fermer une boucle ou une condition. Seul le contexte (la pile) permet de trancher.

10. **Le traitement côté client est un vrai avantage.** Pas de serveur à maintenir, pas de RGPD à gérer pour le transit des données, et l'outil fonctionne même hors ligne une fois chargé.

---

## Glossaire pour les non-devs

| Terme                    | Définition                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tag**                  | Un marqueur entre accolades (ex: `{adf_intitule}`) inséré dans un modèle Word. Dendreo le remplace par la vraie donnée lors de la génération du document.                                                                  |
| **Run (`<w:r>`)**        | Un segment de texte dans Word qui partage le même formatage. Un mot en gras est un run, le mot suivant en normal est un autre run.                                                                                         |
| **Paragraphe (`<w:p>`)** | Un bloc de texte dans Word, délimité par un retour à la ligne.                                                                                                                                                             |
| **XML**                  | Un format de fichier structuré avec des balises (comme du HTML). C'est ce que Word utilise en interne pour stocker le contenu du document.                                                                                 |
| **ZIP**                  | Un format d'archive qui compresse plusieurs fichiers en un seul. Un fichier .docx est secrètement un fichier .zip.                                                                                                         |
| **Regex**                | Une expression régulière : un motif de recherche qui permet de trouver du texte correspondant à certains critères. Par exemple, « tout ce qui est entre `{` et `}` ».                                                      |
| **Pile (Stack)**         | Une structure de données « dernier entré, premier sorti ». Comme une pile d'assiettes : on pose et on retire toujours par le dessus. Utilisée pour vérifier que les tags ouvrants et fermants sont correctement imbriqués. |
| **DOM**                  | Document Object Model. Une représentation en mémoire d'un document XML ou HTML sous forme d'arbre. Utile en général, mais dangereux pour le XML Word.                                                                      |
| **JSZip**                | Une librairie JavaScript qui permet de manipuler des fichiers ZIP dans le navigateur.                                                                                                                                      |
| **Namespace**            | Un préfixe dans le XML qui évite les conflits de noms. Par exemple, `w:` dans `<w:p>` signifie que `p` appartient au vocabulaire WordprocessingML.                                                                         |
| **Entité HTML**          | Un code spécial pour représenter un caractère réservé. `&lt;` représente `<`, `&gt;` représente `>`, `&amp;` représente `&`.                                                                                               |
| **Orphelin**             | Un tag fermant (`{/nom}`) qui n'a pas de tag ouvrant correspondant dans le document.                                                                                                                                       |
| **Croisement**           | Deux tags imbriqués qui se ferment dans le mauvais ordre. Comme des parenthèses mal imbriquées : `( [ ) ]` au lieu de `( [ ] )`.                                                                                           |
| **Côté client**          | Le traitement se fait dans le navigateur de l'utilisateur, pas sur un serveur distant. Les fichiers ne quittent jamais l'ordinateur.                                                                                       |

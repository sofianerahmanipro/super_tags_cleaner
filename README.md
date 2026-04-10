# Super Tags Cleaner

![Version](https://img.shields.io/badge/version-1.2.0-orange?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-latest-8B5CF6?style=flat-square)
![License](https://img.shields.io/badge/licence-privée-lightgrey?style=flat-square)

> Nettoyez vos fichiers Word en un glisser-déposer.  
> Aucun upload serveur - tout se passe dans votre navigateur.

---

## Le problème

Word casse les tags Dendreo. Pas méchamment - mais systématiquement, dès qu'on touche au formatage. Résultat : `{adf_intitule}` devient un fragment XML illisible, Dendreo ne le reconnaît plus, et le client rappelle.

**Super Tags Cleaner** automatise la correction. Déposez vos fichiers `.docx`, récupérez-les nettoyés. C'est tout.

---

## Fonctionnalités

### Clean My Tags
Répare les tags Dendreo fragmentés par Word. L'outil dézippe le `.docx`, parcourt tous les fichiers XML (document, en-têtes, pieds de page…), fusionne les runs brisés et repackage le fichier - sans toucher au reste du document.

### Clean My Syntaxe
Analyse la syntaxe de vos tags Dendreo directement dans le texte. Détecte les balises non fermées, les fautes de frappe et les opérateurs incorrects, avec un rapport d'erreurs clair et actionnable.

---

## Stack technique

| Couche | Stack |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19.2 + TypeScript 5 |
| Style | Tailwind CSS 4 |
| Composants | Radix UI + Lucide React |
| Traitement .docx | JSZip + FileSaver |
| Notifications | Sonner |
| Thème | next-themes |

Toute la logique de traitement tourne **côté client**, dans le navigateur. Aucun fichier ne transite par un serveur.

---

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

---

## Coulisses du projet

### [Journal de bord — Documentation/Journal.md](Documentation/Journal.md)

Vous vous demandez pourquoi Word casse les tags ? Ce qu'est vraiment un fichier `.docx` sous le capot ? Comment une regex peut tenir lieu de colle entre des fragments XML éparpillés ?

Le journal de bord retrace toute la conception de cet outil : les fausses pistes, les bugs mémorables, les décisions d'architecture et les leçons apprises. Écrit par un CSM Care qui a décidé de coder son propre outil plutôt que de refaire la même manipulation pour la centième fois.

**Ce que vous y trouverez :**
- La structure interne d'un `.docx` expliquée simplement
- Pourquoi Word fragmente les tags et comment le détecter
- L'évolution du moteur de nettoyage, version par version
- Un glossaire pour les non-devs

Une bonne lecture si vous voulez comprendre ce qui se passe vraiment quand vous cliquez sur "Nettoyer".

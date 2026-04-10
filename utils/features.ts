import { Tag, FileCode } from "lucide-react";


export const features = [
  {
    href: "/clean-tags",
    icon: Tag,
    title: "Clean My Tags",
    description:
      "Répare les tags Dendreo cassés dans vos fichiers .docx. Word insère parfois des balises XML au milieu des tags — cet outil les fusionne automatiquement.",
    color: "hsl(25,86%,59%)",
  },
  {
    href: "/clean-syntax",
    icon: FileCode,
    title: "Clean My Syntaxe",
    description:
      "Vérifiez et corrigez la syntaxe de vos tags Dendreo. Détecte les erreurs de frappe, les boucles ou conditions non fermées et les opérateurs incorrects.",
    color: "hsl(152,42%,49%)",
    wip: true,
  },
];
export interface PatchNote {
  version: string;
  date: string; 
  description: string;
  level: 0 | 1 | 2; // 0 = fix/mineur, 1 = fonctionnalité, 2 = majeur
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: "1.2.6",
    date: "2026-04-10",
    description:
      "Amélioration de la Sidebar et ajout d'un panneau permettant d'afficher les notes de mise à jour.",
    level: 0,
  },
  {
    version: "1.2.5",
    date: "2026-04-08",
    description:
      "Correction d'un bug dans l'analyse d'imbrication des tags (faux positifs sur les tags orphelins) et pagination des résultats pour les fichiers avec de nombreuses erreurs.",
    level: 0,
  },
  {
    version: "1.2.0",
    date: "2026-04-05",
    description:
      "Sortie de la fonctionnalité Clean My Syntaxe : analyse complète de la syntaxe des tags Dendreo avec rapport d'erreurs détaillé.",
    level: 1,
  },
  {
    version: "1.1.0",
    date: "2026-03-29",
    description:
      "Ajout du support multi-fichiers dans Clean My Tags et amélioration de la gestion des opérateurs multi-caractères.",
    level: 0,
  },
  {
    version: "1.0.0",
    date: "2026-03-28",
    description:
      "Première version de Super Tags Cleaner avec la fonctionnalité Clean My Tags.",
    level: 2,
  },
];

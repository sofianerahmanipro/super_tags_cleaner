import type { ExtractedTag } from "./tag-extractor";

export interface SyntaxError {
  severity: "error" | "warning";
  message: string;
  tag: string;
  occurrence?: number;
  relatedTag?: string;
  rule: string;
  page?: number;
}

function ordinalFr(n: number): string {
  if (n === 1) return "1ʳᵉ";
  return `${n}ᵉ`;
}

const ACCENT_RE = /[àâäéèêëîïôöùûüÿçæœÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇÆŒ]/;
const VALID_NAME_CHARS_RE = /^[a-zA-Z0-9_\s]*$/;

function realTags(tags: ExtractedTag[]): ExtractedTag[] {
  return tags.filter((t) => t.type !== "unmatched_open_brace");
}

export function ruleSpaceInTag(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter((tag) => {
      const namePart = [tag.name, tag.subfield, tag.counter]
        .filter(Boolean)
        .join("");
      return /\s/.test(namePart);
    })
    .map((tag) => ({
      severity: "error" as const,
      message: `Un espace a été détecté dans le tag ${tag.raw}. Les tags ne doivent pas contenir d'espace dans leur nom. Veuillez le corriger.`,
      tag: tag.raw,
      rule: "space_in_tag",
      page: tag.page,
    }));
}

export function ruleAccentInTag(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter((tag) => {
      const namePart = [tag.name, tag.subfield, tag.counter]
        .filter(Boolean)
        .join("");
      return ACCENT_RE.test(namePart);
    })
    .map((tag) => ({
      severity: "error" as const,
      message: `Un accent a été détecté dans le tag ${tag.raw}. Les tags ne doivent pas contenir d'accent dans leur nom. Veuillez le corriger.`,
      tag: tag.raw,
      rule: "accent_in_tag",
      page: tag.page,
    }));
}

export function ruleUppercaseInTag(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter((tag) => {
      const name = tag.name;
      return name !== name.toLowerCase() && name !== name.toUpperCase();
    })
    .map((tag) => ({
      severity: "error" as const,
      message: `Le tag ${tag.raw} mélange majuscules et minuscules. Les tags doivent être entièrement en minuscules ou entièrement en majuscules. Veuillez le corriger.`,
      tag: tag.raw,
      rule: "uppercase_in_tag",
      page: tag.page,
    }));
}

export interface Rule8Result {
  errors: SyntaxError[];
  tableClosingPositions: Set<number>;
}

export function ruleTableLoopHasClosing(tags: ExtractedTag[]): Rule8Result {
  const errors: SyntaxError[] = [];
  const tableClosingPositions = new Set<number>();

  const real = realTags(tags);

  const openCount = new Map<string, number>();
  const tableTagsByName = new Map<string, ExtractedTag[]>();
  const closingTagsByName = new Map<string, ExtractedTag[]>();

  for (const tag of real) {
    if (tag.type === "loop_open" || tag.type === "condition_open") {
      openCount.set(tag.name, (openCount.get(tag.name) ?? 0) + 1);
    } else if (tag.type === "loop_table") {
      const arr = tableTagsByName.get(tag.name) ?? [];
      arr.push(tag);
      tableTagsByName.set(tag.name, arr);
    } else if (tag.type === "loop_close") {
      const arr = closingTagsByName.get(tag.name) ?? [];
      arr.push(tag);
      closingTagsByName.set(tag.name, arr);
    }
  }

  for (const [name, closingTags] of closingTagsByName) {
    const tableTags = tableTagsByName.get(name) ?? [];
    if (tableTags.length === 0) continue;

    const openers = openCount.get(name) ?? 0;
    const surplus = closingTags.length - openers;

    if (surplus > 0) {
      const surplusTags = closingTags.slice(closingTags.length - surplus);
      const tableTagRaw = tableTags[0].raw;
      for (const closingTag of surplusTags) {
        tableClosingPositions.add(closingTag.position);
        errors.push({
          severity: "error",
          message: `Le tag ${tableTagRaw} est une boucle de tableau et ne nécessite pas de tag fermant. Le tag ${closingTag.raw} trouvé est probablement en trop. Veuillez le supprimer.`,
          tag: tableTagRaw,
          relatedTag: closingTag.raw,
          rule: "table_loop_has_closing",
          page: closingTag.page,
        });
      }
    }
  }

  return { errors, tableClosingPositions };
}

export function analyzeNesting(
  tags: ExtractedTag[],
  tableClosingPositions: Set<number>
): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const stack: ExtractedTag[] = [];
  const real = realTags(tags);

  const totalByKey = new Map<string, number>();
  for (const tag of real) {
    const key = `${tag.prefix}${tag.name}`;
    totalByKey.set(key, (totalByKey.get(key) ?? 0) + 1);
  }

  function occLabel(tag: ExtractedTag, typeLabel: string): string {
    const total = totalByKey.get(`${tag.prefix}${tag.name}`) ?? 1;
    return total > 1
      ? `La ${ordinalFr(tag.occurrence)} ${typeLabel}`
      : `La ${typeLabel}`;
  }

  function orphanMessage(tag: ExtractedTag): string {
    const total = totalByKey.get(`${tag.prefix}${tag.name}`) ?? 1;
    const prefix = total > 1 ? `Le ${ordinalFr(tag.occurrence)} tag fermant` : "Le tag fermant";
    return `${prefix} ${tag.raw} n'a pas de tag ouvrant correspondant. Veuillez le supprimer ou ajouter le tag ouvrant manquant.`;
  }

  for (const tag of real) {
    if (
      tag.type === "loop_close" &&
      tableClosingPositions.has(tag.position)
    ) {
      continue;
    }

    if (tag.type === "loop_open" || tag.type === "condition_open") {
      stack.push(tag);
    } else if (tag.type === "loop_close" || tag.type === "condition_close") {
      if (stack.length === 0) {
        errors.push({
          severity: "error",
          message: orphanMessage(tag),
          tag: tag.raw,
          occurrence: tag.occurrence,
          rule: "orphan_closing",
          page: tag.page,
        });
      } else {
        const top = stack[stack.length - 1];
        if (top.name === tag.name) {
          stack.pop();
        } else {
          let indexInStack = -1;
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].name === tag.name) {
              indexInStack = i;
              break;
            }
          }

          if (indexInStack === -1) {
            errors.push({
              severity: "error",
              message: orphanMessage(tag),
              tag: tag.raw,
              occurrence: tag.occurrence,
              rule: "orphan_closing",
              page: tag.page,
            });
          } else {
            const removed = stack.splice(indexInStack);
            for (const unclosedTag of removed.slice(1)) {
              const unclosedTypeLabel =
                unclosedTag.type === "loop_open" ? "boucle" : "condition";
              errors.push({
                severity: "error",
                message: `${occLabel(unclosedTag, unclosedTypeLabel)} ${unclosedTag.raw} n'est jamais fermée. Veuillez ajouter son tag fermant {/${unclosedTag.name}}.`,
                tag: unclosedTag.raw,
                occurrence: unclosedTag.occurrence,
                rule: "unclosed",
                page: unclosedTag.page,
              });
            }
          }
        }
      }
    }
  }

  for (const remaining of stack) {
    const typeLabel =
      remaining.type === "loop_open" ? "boucle" : "condition";
    errors.push({
      severity: "error",
      message: `${occLabel(remaining, typeLabel)} ${remaining.raw} n'est jamais fermée. Veuillez ajouter son tag fermant {/${remaining.name}}.`,
      tag: remaining.raw,
      occurrence: remaining.occurrence,
      rule: "unclosed",
      page: remaining.page,
    });
  }

  return errors;
}

export function ruleUnclosedBrace(tags: ExtractedTag[]): SyntaxError[] {
  return tags
    .filter((t) => t.type === "unmatched_open_brace")
    .map((tag) => ({
      severity: "error" as const,
      message: `Une accolade ouvrante "{" a été détectée sans accolade fermante correspondante. Vérifiez qu'il ne manque pas un "}" dans votre document.`,
      tag: "{",
      rule: "unclosed_brace",
      page: tag.page,
    }));
}

export function ruleEmptyTag(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter((tag) => tag.name === "" && tag.subfield === undefined)
    .map((tag) => ({
      severity: "error" as const,
      message: `Un tag vide ${tag.raw} a été détecté. Chaque tag doit contenir un nom. Veuillez le compléter ou le supprimer.`,
      tag: tag.raw,
      rule: "empty_tag",
      page: tag.page,
    }));
}

export function ruleInvalidOperator(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter((tag) => {
      if (tag.type !== "condition_open") return false;
      if (tag.operator !== undefined) return false;
      return !VALID_NAME_CHARS_RE.test(tag.name);
    })
    .map((tag) => ({
      severity: "error" as const,
      message: `L'opérateur utilisé dans le tag ${tag.raw} n'est pas reconnu. Les opérateurs valides sont : =, ==, !=, <>, >, >=, <, <=.`,
      tag: tag.raw,
      rule: "invalid_operator",
      page: tag.page,
    }));
}

export function ruleConditionalLoopNoOperator(tags: ExtractedTag[]): SyntaxError[] {
  return realTags(tags)
    .filter(
      (tag) =>
        tag.type === "loop_open" &&
        tag.subfield !== undefined &&
        tag.operator === undefined
    )
    .map((tag) => ({
      severity: "warning" as const,
      message: `La boucle conditionnelle ${tag.raw} n'a pas d'opérateur de comparaison. Vouliez-vous écrire {#${tag.name}:${tag.subfield}!=} pour tester l'existence ?`,
      tag: tag.raw,
      rule: "conditional_loop_no_operator",
      page: tag.page,
    }));
}

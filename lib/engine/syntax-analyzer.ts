import JSZip from "jszip";
import { extractAllTags, extractTextFromXml, extractTextAndPageBreaks, type ExtractedTag } from "./tag-extractor";
import {
  ruleSpaceInTag,
  ruleAccentInTag,
  ruleUppercaseInTag,
  ruleTableLoopHasClosing,
  analyzeNesting,
  ruleUnclosedBrace,
  ruleEmptyTag,
  ruleInvalidOperator,
  ruleConditionalLoopNoOperator,
  type SyntaxError,
} from "./syntax-rules";

export type { SyntaxError };

export interface AnalysisResult {
  fileName: string;
  errors: SyntaxError[];
  totalPages: number;
  success: boolean;
  error?: string;
}

export function analyzeSyntax(tags: ExtractedTag[]): SyntaxError[] {
  const errors: SyntaxError[] = [];

  errors.push(...ruleSpaceInTag(tags));
  errors.push(...ruleAccentInTag(tags));
  errors.push(...ruleUppercaseInTag(tags));
  errors.push(...ruleUnclosedBrace(tags));
  errors.push(...ruleEmptyTag(tags));
  errors.push(...ruleInvalidOperator(tags));
  errors.push(...ruleConditionalLoopNoOperator(tags));

  const { errors: rule8Errors, tableClosingPositions } =
    ruleTableLoopHasClosing(tags);
  errors.push(...rule8Errors);

  errors.push(...analyzeNesting(tags, tableClosingPositions));

  return errors;
}

export async function analyzeDocx(file: File): Promise<AnalysisResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    const xmlFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("word/") && name.endsWith(".xml")
    );

    const allTags: ExtractedTag[] = [];
    let totalPages = 0;

    for (const xmlPath of xmlFiles) {
      const content = await zip.file(xmlPath)!.async("string");
      let text: string;
      let pageBreaks: number[] = [];

      if (xmlPath === "word/document.xml") {
        const extracted = extractTextAndPageBreaks(content);
        text = extracted.text;
        pageBreaks = extracted.pageBreaks;
        totalPages = pageBreaks.length === 0 ? 0 : pageBreaks.length + 1;
      } else {
        text = extractTextFromXml(content);
      }

      const tags = extractAllTags(text, xmlPath, pageBreaks);
      allTags.push(...tags);
    }

    const counts: Record<string, number> = {};
    for (const tag of allTags) {
      const key =
        tag.type === "unmatched_open_brace"
          ? "__brace__"
          : `${tag.prefix}${tag.name}`;
      counts[key] = (counts[key] ?? 0) + 1;
      tag.occurrence = counts[key];
    }

    const errors = analyzeSyntax(allTags);

    return {
      fileName: file.name,
      errors,
      totalPages,
      success: true,
    };
  } catch (error) {
    return {
      fileName: file.name,
      errors: [],
      totalPages: 0,
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

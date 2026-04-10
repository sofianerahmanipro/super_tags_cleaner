import { TAG_PATTERN } from "./tag-pattern";

export interface FixedTag {
  original: string;
  fixed: string;
  file: string;
  fragments: number;
}

interface RunInfo {
  fullMatch: string;
  text: string;
  textStart: number;
  textEnd: number;
  startIndex: number;
  endIndex: number;
  isRun: boolean;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXmlEntities(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

function extractTextFromRun(runXml: string): string {
  const textParts: string[] = [];
  const wtPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = wtPattern.exec(runXml)) !== null) {
    textParts.push(decodeXmlEntities(match[1]));
  }
  return textParts.join("");
}

function buildWt(text: string): string {
  const encoded = encodeXmlEntities(text);
  if (text.startsWith(" ") || text.endsWith(" ")) {
    return `<w:t xml:space="preserve">${encoded}</w:t>`;
  }
  return `<w:t>${encoded}</w:t>`;
}

function replaceRunText(runXml: string, newText: string): string {
  const withoutWt = runXml.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, "");
  return withoutWt.replace(/<\/w:r\s*>/, buildWt(newText) + "</w:r>");
}

export function cleanBrokenTags(
  xmlContent: string,
  fileName = ""
): { cleaned: string; fixedTags: FixedTag[] } {
  const fixedTags: FixedTag[] = [];

  const paragraphPattern = /<w:p[\s>].*?<\/w:p\s*>/gs;

  const cleaned = xmlContent.replace(paragraphPattern, (pXml) => {
    const result = fixTagsInParagraph(pXml, fileName);
    fixedTags.push(...result.fixedTags);
    return result.cleaned;
  });

  return { cleaned, fixedTags };
}

function fixTagsInParagraph(
  pXml: string,
  fileName: string
): { cleaned: string; fixedTags: FixedTag[] } {
  const fixedTags: FixedTag[] = [];
  const runs: RunInfo[] = [];

  const elementPattern =
    /(<w:r[\s>][\s\S]*?<\/w:r\s*>)|(<w:proofErr[^>]*\/>)|(<w:bookmarkStart[^>]*\/?>)|(<w:bookmarkEnd[^>]*\/?>)|(<w:del[\s>][\s\S]*?<\/w:del\s*>)|(<w:ins[\s>][\s\S]*?<\/w:ins\s*>)/g;

  let concatOffset = 0;
  let match: RegExpExecArray | null;

  while ((match = elementPattern.exec(pXml)) !== null) {
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = match.index + fullMatch.length;
    const isRun = fullMatch.startsWith("<w:r");

    let text = "";
    if (isRun) {
      text = extractTextFromRun(fullMatch);
    }

    runs.push({
      fullMatch,
      text,
      textStart: concatOffset,
      textEnd: concatOffset + text.length,
      startIndex,
      endIndex,
      isRun,
    });

    concatOffset += text.length;
  }

  const fullText = runs.map((r) => r.text).join("");

  if (!fullText.includes("{")) {
    return { cleaned: pXml, fixedTags };
  }

  const tagRegex = new RegExp(TAG_PATTERN.source, "g");
  const tags: Array<{ text: string; start: number; end: number }> = [];
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRegex.exec(fullText)) !== null) {
    tags.push({
      text: tagMatch[0],
      start: tagMatch.index,
      end: tagMatch.index + tagMatch[0].length,
    });
  }

  if (tags.length === 0) {
    return { cleaned: pXml, fixedTags };
  }

  function runIndexAtTextPos(pos: number): number {
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (!r.isRun) continue;
      if (r.textStart <= pos && pos < r.textEnd) return i;
    }
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].isRun && runs[i].textEnd === pos) return i;
    }
    return -1;
  }

  interface TagFix {
    tagText: string;
    tagStart: number;
    tagEnd: number;
    firstRunIdx: number;
    lastRunIdx: number;
  }

  const tagsToFix: TagFix[] = [];

  for (const tag of tags) {
    const firstRunIdx = runIndexAtTextPos(tag.start);
    const lastRunIdx = runIndexAtTextPos(tag.end - 1);

    if (firstRunIdx === -1 || lastRunIdx === -1) continue;
    if (firstRunIdx === lastRunIdx) continue;

    tagsToFix.push({
      tagText: tag.text,
      tagStart: tag.start,
      tagEnd: tag.end,
      firstRunIdx,
      lastRunIdx,
    });
  }

  if (tagsToFix.length === 0) {
    return { cleaned: pXml, fixedTags };
  }

  const runsCopy = runs.map((r) => ({ ...r, deleted: false, newText: r.text }));

  tagsToFix.sort((a, b) => b.tagStart - a.tagStart);

  for (const fix of tagsToFix) {
    const { tagText, tagStart, tagEnd, firstRunIdx, lastRunIdx } = fix;

    const firstRun = runsCopy[firstRunIdx];
    const lastRun = runsCopy[lastRunIdx];

    const prefixLen = tagStart - firstRun.textStart;
    const prefix = firstRun.newText.slice(0, prefixLen);

    const suffixStart = tagEnd - lastRun.textStart;
    const suffix = lastRun.newText.slice(suffixStart);

    firstRun.newText = prefix + tagText;

    if (firstRunIdx !== lastRunIdx) {
      if (suffix.length > 0) {
        lastRun.newText = suffix;
      } else {
        lastRun.deleted = true;
      }
    }

    for (let i = firstRunIdx + 1; i < lastRunIdx; i++) {
      runsCopy[i].deleted = true;
    }

    const xmlRangeStart = firstRun.startIndex;
    const xmlRangeEnd = lastRun.endIndex;
    for (const r of runsCopy) {
      if (!r.isRun && !r.deleted) {
        if (r.startIndex > xmlRangeStart && r.endIndex <= xmlRangeEnd) {
          r.deleted = true;
        }
      }
    }

    const fragments = runsCopy
      .slice(firstRunIdx, lastRunIdx + 1)
      .filter((r) => r.isRun).length;

    fixedTags.push({ original: tagText, fixed: tagText, file: fileName, fragments });
  }

  let result = pXml;

  const sortedByPosition = [...runsCopy].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const run of sortedByPosition) {
    if (run.deleted) {
      result = result.slice(0, run.startIndex) + result.slice(run.endIndex);
    } else if (run.isRun && run.newText !== run.text) {
      const newRunXml = replaceRunText(run.fullMatch, run.newText);
      result =
        result.slice(0, run.startIndex) +
        newRunXml +
        result.slice(run.endIndex);
    }
  }

  return { cleaned: result, fixedTags };
}

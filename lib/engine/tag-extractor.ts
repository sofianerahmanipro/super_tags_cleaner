export type TagType =
  | "simple"
  | "loop_open"
  | "loop_close"
  | "loop_table"
  | "condition_open"
  | "condition_close"
  | "unmatched_open_brace";

export interface ExtractedTag {
  raw: string;
  content: string;
  type: TagType;
  name: string;
  prefix: string;
  operator?: string;
  value?: string;
  subfield?: string;
  counter?: string;
  closesAll?: boolean;
  position: number;
  occurrence: number;
  xmlFile: string;
  page?: number;
}

const PERMISSIVE_TAG_PATTERN = /\{[#]{0,2}[?/]?[^}]*\}/g;

const OPERATORS = [">=", "<=", "<>", "!=", "==", ">", "<", "="] as const;

function parseTag(raw: string, position: number, xmlFile: string): ExtractedTag {
  const content = raw.slice(1, -1); 

  let prefix = "";
  let rest = content;

  if (rest.startsWith("##")) {
    prefix = "##";
    rest = rest.slice(2);
  } else if (rest.startsWith("#")) {
    prefix = "#";
    rest = rest.slice(1);
  } else if (rest.startsWith("?")) {
    prefix = "?";
    rest = rest.slice(1);
  } else if (rest.startsWith("/")) {
    prefix = "/";
    rest = rest.slice(1);
  }

  let operator: string | undefined;
  let value: string | undefined;
  let nameAndMods = rest;

  for (const op of OPERATORS) {
    const idx = rest.indexOf(op);
    if (idx !== -1) {
      nameAndMods = rest.slice(0, idx);
      operator = op;
      value = rest.slice(idx + op.length);
      break;
    }
  }

  let namePart = nameAndMods;
  let counter: string | undefined;
  let subfield: string | undefined;

  const commaIdx = namePart.indexOf(",");
  if (commaIdx !== -1) {
    let afterComma = namePart.slice(commaIdx + 1);
    namePart = namePart.slice(0, commaIdx);
    const colonInCounter = afterComma.indexOf(":");
    if (colonInCounter !== -1) {
      subfield = afterComma.slice(colonInCounter + 1);
      counter = afterComma.slice(0, colonInCounter);
    } else {
      counter = afterComma;
    }
  }

  const colonIdx = namePart.indexOf(":");
  if (colonIdx !== -1) {
    subfield = namePart.slice(colonIdx + 1);
    namePart = namePart.slice(0, colonIdx);
  }

  let type: TagType;
  let closesAll: boolean | undefined;

  if (prefix === "##") {
    type = "loop_table";
  } else if (prefix === "#") {
    type = "loop_open";
  } else if (prefix === "?") {
    type = "condition_open";
  } else if (prefix === "/") {
    type = "loop_close";
    if (namePart.endsWith("*")) {
      namePart = namePart.slice(0, -1);
      closesAll = true;
    }
  } else {
    type = "simple";
  }

  return {
    raw,
    content,
    type,
    name: namePart,
    prefix,
    operator,
    value,
    subfield,
    counter,
    closesAll,
    position,
    occurrence: 0,
    xmlFile,
  };
}

function getPageForPosition(position: number, pageBreaks: number[]): number {
  let page = 1;
  for (const breakPos of pageBreaks) {
    if (position >= breakPos) {
      page++;
    } else {
      break;
    }
  }
  return page;
}

export function extractAllTags(text: string, xmlFile = "document.xml", pageBreaks: number[] = []): ExtractedTag[] {
  const tags: ExtractedTag[] = [];
  const pattern = new RegExp(PERMISSIVE_TAG_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const tag = parseTag(match[0], match.index, xmlFile);
    if (pageBreaks.length > 0) {
      tag.page = getPageForPosition(match.index, pageBreaks);
    }
    tags.push(tag);
  }

  const matchedRanges: Array<[number, number]> = tags
    .filter((t) => t.type !== "unmatched_open_brace")
    .map((t) => [t.position, t.position + t.raw.length]);

  function isInsideMatchedTag(pos: number): boolean {
    return matchedRanges.some(([start, end]) => pos >= start && pos < end);
  }

  let inBrace = false;
  let braceStart = -1;
  for (let i = 0; i < text.length; i++) {
    if (isInsideMatchedTag(i)) continue;
    if (text[i] === "{") {
      if (inBrace) {
        tags.push({
          raw: "{",
          content: "",
          type: "unmatched_open_brace",
          name: "",
          prefix: "",
          position: braceStart,
          occurrence: 0,
          xmlFile,
          page: pageBreaks.length > 0 ? getPageForPosition(braceStart, pageBreaks) : undefined,
        });
      }
      inBrace = true;
      braceStart = i;
    } else if (text[i] === "}") {
      inBrace = false;
    }
  }
  if (inBrace) {
    tags.push({
      raw: "{",
      content: "",
      type: "unmatched_open_brace",
      name: "",
      prefix: "",
      position: braceStart,
      occurrence: 0,
      xmlFile,
      page: pageBreaks.length > 0 ? getPageForPosition(braceStart, pageBreaks) : undefined,
    });
  }

  tags.sort((a, b) => a.position - b.position);

  const counts: Record<string, number> = {};
  for (const tag of tags) {
    const key =
      tag.type === "unmatched_open_brace"
        ? "__brace__"
        : `${tag.prefix}${tag.name}`;
    counts[key] = (counts[key] || 0) + 1;
    tag.occurrence = counts[key];
  }

  return tags;
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function extractTextFromXml(xmlContent: string): string {
  const matches = xmlContent.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? [];
  return matches
    .map((m) => {
      const inner = m.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      return inner ? decodeXmlEntities(inner[1]) : "";
    })
    .join("");
}

const PAGE_BREAK_OR_WT_RE =
  /<w:lastRenderedPageBreak[^>]*\/>|<w:br\b[^>]*w:type="page"[^>]*\/?>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

export function extractTextAndPageBreaks(xmlContent: string): { text: string; pageBreaks: number[] } {
  const pageBreaks: number[] = [];
  let text = "";
  let pendingBreak = false;

  const re = new RegExp(PAGE_BREAK_OR_WT_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(xmlContent)) !== null) {
    const full = match[0];
    if (full.startsWith("<w:t")) {
      const inner = full.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      const textContent = inner ? decodeXmlEntities(inner[1]) : "";
      if (pendingBreak) {
        pageBreaks.push(text.length);
        pendingBreak = false;
      }
      text += textContent;
    } else {
      pendingBreak = true;
    }
  }

  return { text, pageBreaks };
}

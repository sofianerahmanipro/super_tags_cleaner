import { describe, test, expect } from "bun:test";
import { extractAllTags, extractTextAndPageBreaks } from "@/lib/engine/tag-extractor";
import { analyzeSyntax } from "@/lib/engine/syntax-analyzer";

describe("extractTextAndPageBreaks — extraction de texte", () => {
  test("extrait le texte identiquement à extractTextFromXml sur un document sans saut de page", () => {
    const xml = `<w:body><w:p><w:r><w:t>{adf_intitule}</w:t></w:r></w:p></w:body>`;
    const { text, pageBreaks } = extractTextAndPageBreaks(xml);
    expect(text).toBe("{adf_intitule}");
    expect(pageBreaks).toHaveLength(0);
  });

  test("retourne pageBreaks vide quand il n'y a aucun marqueur de page", () => {
    const xml = `<w:p><w:r><w:t>Texte sans saut</w:t></w:r></w:p>`;
    const { pageBreaks } = extractTextAndPageBreaks(xml);
    expect(pageBreaks).toHaveLength(0);
  });

  test("détecte un lastRenderedPageBreak et retourne la position correcte", () => {
    const xml = `<w:p>
      <w:r><w:t>ABC</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>DEF</w:t></w:r>
    </w:p>`;
    const { text, pageBreaks } = extractTextAndPageBreaks(xml);
    expect(text).toBe("ABCDEF");
    expect(pageBreaks).toHaveLength(1);
    expect(pageBreaks[0]).toBe(3);
  });

  test("détecte un saut de page manuel <w:br w:type=\"page\"/>", () => {
    const xml = `<w:p>
      <w:r><w:t>Page1</w:t></w:r>
      <w:r><w:br w:type="page"/></w:r>
      <w:r><w:t>Page2</w:t></w:r>
    </w:p>`;
    const { text, pageBreaks } = extractTextAndPageBreaks(xml);
    expect(text).toBe("Page1Page2");
    expect(pageBreaks).toHaveLength(1);
    expect(pageBreaks[0]).toBe(5);
  });

  test("détecte deux sauts de page (3 pages)", () => {
    const xml = `<w:body>
      <w:r><w:t>P1</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>P2</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>P3</w:t></w:r>
    </w:body>`;
    const { pageBreaks } = extractTextAndPageBreaks(xml);
    expect(pageBreaks).toHaveLength(2);
    expect(pageBreaks[0]).toBe(2);
    expect(pageBreaks[1]).toBe(4);
  });

  test("lastRenderedPageBreak dans un run sans w:t immédiat : position = prochain w:t", () => {
    const xml = `<w:body>
      <w:r><w:t>Before</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/></w:r>
      <w:r><w:t>After</w:t></w:r>
    </w:body>`;
    const { text, pageBreaks } = extractTextAndPageBreaks(xml);
    expect(text).toBe("BeforeAfter");
    expect(pageBreaks).toHaveLength(1);
    expect(pageBreaks[0]).toBe(6);
  });
});

describe("Attribution des pages aux tags", () => {
  test("attribue page 1 aux tags avant le premier lastRenderedPageBreak", () => {
    const text = "{adf_intitule}XYZ{fact_nom}";
    const pageBreaks = [17];
    const tags = extractAllTags(text, "word/document.xml", pageBreaks);
    const t = tags.find((t) => t.name === "adf_intitule");
    expect(t?.page).toBe(1);
  });

  test("attribue page 2 aux tags après le premier lastRenderedPageBreak", () => {
    const text = "{adf_intitule}XYZ{fact_nom}";
    const pageBreaks = [17];
    const tags = extractAllTags(text, "word/document.xml", pageBreaks);
    const t = tags.find((t) => t.name === "fact_nom");
    expect(t?.page).toBe(2);
  });

  test("attribue page 3 aux tags après le deuxième saut de page", () => {
    const text = "A{tag1}B{tag2}C{tag3}";
    const pageBreaks = [5, 12];
    const tags = extractAllTags(text, "word/document.xml", pageBreaks);
    expect(tags.find((t) => t.name === "tag1")?.page).toBe(1);
    expect(tags.find((t) => t.name === "tag2")?.page).toBe(2);
    expect(tags.find((t) => t.name === "tag3")?.page).toBe(3);
  });

  test("ne numérote pas les pages pour les tags de headers/footers (page undefined)", () => {
    const tags = extractAllTags("{adf_intitule}", "word/header1.xml");
    expect(tags[0].page).toBeUndefined();
  });

  test("ne numérote pas les pages quand aucun pageBreaks n'est fourni", () => {
    const tags = extractAllTags("{adf_intitule}");
    expect(tags[0].page).toBeUndefined();
  });
});

describe("Propagation de page dans les erreurs de syntaxe", () => {
  test("l'erreur uppercase_in_tag hérite du numéro de page du tag", () => {
    const text = "texte{Majuscule}";
    const pageBreaks = [5];
    const tags = extractAllTags(text, "word/document.xml", pageBreaks);
    const errors = analyzeSyntax(tags);
    const err = errors.find((e) => e.rule === "uppercase_in_tag");
    expect(err?.page).toBe(2);
  });

  test("l'erreur unclosed hérite du numéro de page du tag ouvrant", () => {
    const text = "debut{#adf_jours}fin";
    const pageBreaks = [5];
    const tags = extractAllTags(text, "word/document.xml", pageBreaks);
    const errors = analyzeSyntax(tags);
    const err = errors.find((e) => e.rule === "unclosed");
    expect(err?.page).toBe(2);
  });

  test("les erreurs sans pageBreaks n'ont pas de page définie", () => {
    const errors = analyzeSyntax(extractAllTags("{Majuscule}"));
    const err = errors.find((e) => e.rule === "uppercase_in_tag");
    expect(err?.page).toBeUndefined();
  });
});

describe("Non-régression — page est optionnel", () => {
  test("les erreurs existantes conservent rule, message et tag", () => {
    const errors = analyzeSyntax(extractAllTags("{participant_ nom}"));
    const err = errors.find((e) => e.rule === "space_in_tag");
    expect(err).toBeDefined();
    expect(err!.rule).toBe("space_in_tag");
    expect(err!.message).toContain("{participant_ nom}");
    expect(err!.tag).toBe("{participant_ nom}");
  });

  test("totalPages = 0 quand il n'y a aucun saut de page dans le XML", () => {
    const xml = `<w:body><w:r><w:t>{adf_intitule}</w:t></w:r></w:body>`;
    const { pageBreaks } = extractTextAndPageBreaks(xml);
    const totalPages = pageBreaks.length === 0 ? 0 : pageBreaks.length + 1;
    expect(totalPages).toBe(0);
  });

  test("totalPages = 3 quand il y a 2 sauts de page", () => {
    const xml = `<w:body>
      <w:r><w:t>P1</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>P2</w:t></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>P3</w:t></w:r>
    </w:body>`;
    const { pageBreaks } = extractTextAndPageBreaks(xml);
    const totalPages = pageBreaks.length === 0 ? 0 : pageBreaks.length + 1;
    expect(totalPages).toBe(3);
  });
});

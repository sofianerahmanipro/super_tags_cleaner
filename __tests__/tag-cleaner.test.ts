import { describe, test, expect } from "bun:test";
import { cleanBrokenTags } from "../lib/engine/tag-cleaner";

describe("cleanBrokenTags", () => {
  test("fusionne un tag simple cassé sur 3 <w:r>", () => {
    const input = `<w:p><w:r><w:t>{adf_</w:t></w:r><w:r><w:t>liste</w:t></w:r><w:r><w:t>_complete}</w:t></w:r></w:p>`;
    const { cleaned, fixedTags } = cleanBrokenTags(input);
    expect(cleaned).toContain("{adf_liste_complete}");
    expect(fixedTags).toHaveLength(1);
    expect(fixedTags[0].fixed).toBe("{adf_liste_complete}");
  });

  test("préserve l'opérateur = dans un tag cassé", () => {
    const input = `<w:p><w:r><w:t>{?</w:t></w:r><w:r><w:t>ent_particulier</w:t></w:r><w:r><w:t>=0}</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("{?ent_particulier=0}");
  });

  test("gère deux tags cassés consécutifs sans corrompre le XML", () => {
    const input = `<w:p>
    <w:r><w:t xml:space="preserve">Fait à {</w:t></w:r>
    <w:proofErr w:type="spellStart"/>
    <w:r><w:t>conf_of_ville</w:t></w:r>
    <w:proofErr w:type="spellEnd"/>
    <w:r><w:t xml:space="preserve">}, le {</w:t></w:r>
    <w:proofErr w:type="spellStart"/>
    <w:r><w:t>g_date_edition_texte</w:t></w:r>
    <w:proofErr w:type="spellEnd"/>
    <w:r><w:t>},</w:t></w:r>
  </w:p>`;
    const { cleaned, fixedTags } = cleanBrokenTags(input);
    expect(cleaned).toContain("{conf_of_ville}");
    expect(cleaned).toContain("{g_date_edition_texte}");
    expect(fixedTags).toHaveLength(2);
    expect(cleaned).toContain("Fait à {conf_of_ville}");
    expect(cleaned).toContain(", le {g_date_edition_texte}");
  });

  test("gère trois tags cassés consécutifs", () => {
    const input = `<w:p>
    <w:r><w:t>{</w:t></w:r><w:proofErr w:type="spellStart"/>
    <w:r><w:t>ent_representant_prenom</w:t></w:r><w:proofErr w:type="spellEnd"/>
    <w:r><w:t xml:space="preserve">} {</w:t></w:r><w:proofErr w:type="spellStart"/>
    <w:r><w:t>ent_representant_nom</w:t></w:r><w:proofErr w:type="spellEnd"/>
    <w:r><w:t xml:space="preserve">}, {</w:t></w:r><w:proofErr w:type="spellStart"/>
    <w:r><w:t>ent_representant_fonction_sans</w:t></w:r><w:proofErr w:type="spellEnd"/>
    <w:r><w:t>}</w:t></w:r>
  </w:p>`;
    const { cleaned, fixedTags } = cleanBrokenTags(input);
    expect(cleaned).toContain("{ent_representant_prenom}");
    expect(cleaned).toContain("{ent_representant_nom}");
    expect(cleaned).toContain("{ent_representant_fonction_sans}");
    expect(fixedTags).toHaveLength(3);
  });

  test("ne modifie pas un tag déjà dans un seul <w:r>", () => {
    const input = `<w:p><w:r><w:t>{adf_intitule}</w:t></w:r></w:p>`;
    const { cleaned, fixedTags } = cleanBrokenTags(input);
    expect(cleaned).toBe(input);
    expect(fixedTags).toHaveLength(0);
  });

  test("fusionne un tag avec opérateur >= cassé", () => {
    const input = `<w:p><w:r><w:t>{?note</w:t></w:r><w:r><w:t>>=</w:t></w:r><w:r><w:t>80}</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("{?note>=80}");
  });

  test("préserve le texte avant le { dans le premier run", () => {
    const input = `<w:p><w:r><w:t xml:space="preserve">Bonjour {</w:t></w:r><w:r><w:t>adf_prenom</w:t></w:r><w:r><w:t>}</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("Bonjour {adf_prenom}");
  });

  test("préserve le texte après le } dans le dernier run", () => {
    const input = `<w:p><w:r><w:t>{</w:t></w:r><w:r><w:t>adf_nom</w:t></w:r><w:r><w:t xml:space="preserve">} !</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("{adf_nom}");
    expect(cleaned).toContain(" !");
  });

  test("fusionne un tag de boucle tableau ##", () => {
    const input = `<w:p><w:r><w:t>{##</w:t></w:r><w:r><w:t>adf_jours</w:t></w:r><w:r><w:t>}</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("{##adf_jours}");
  });

  test("ne modifie pas un paragraphe sans tag", () => {
    const input = `<w:p><w:r><w:t>Bonjour tout le monde</w:t></w:r></w:p>`;
    const { cleaned, fixedTags } = cleanBrokenTags(input);
    expect(cleaned).toBe(input);
    expect(fixedTags).toHaveLength(0);
  });

  test("fusionne un tag de fermeture {/...}", () => {
    const input = `<w:p><w:r><w:t>{/</w:t></w:r><w:r><w:t>adf_jours</w:t></w:r><w:r><w:t>}</w:t></w:r></w:p>`;
    const { cleaned } = cleanBrokenTags(input);
    expect(cleaned).toContain("{/adf_jours}");
  });
});

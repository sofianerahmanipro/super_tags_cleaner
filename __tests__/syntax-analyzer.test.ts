import { describe, test, expect } from "bun:test";
import { analyzeSyntax } from "@/lib/engine/syntax-analyzer";
import { extractAllTags, extractTextFromXml } from "@/lib/engine/tag-extractor";

describe("Règle 1 — Espace dans un tag", () => {
  test("détecte un espace dans le nom du tag", () => {
    const errors = analyzeSyntax(extractAllTags("{participant_ nom}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "space_in_tag" })
    );
  });

  test("détecte un espace en fin de tag", () => {
    const errors = analyzeSyntax(extractAllTags("{participant_nom }"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "space_in_tag" })
    );
  });

  test("détecte un espace en début de tag", () => {
    const errors = analyzeSyntax(extractAllTags("{ participant_nom}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "space_in_tag" })
    );
  });

  test("accepte un espace dans la valeur d'une condition", () => {
    const errors = analyzeSyntax(extractAllTags("{?prenom=John Doe}"));
    expect(errors.filter((e) => e.rule === "space_in_tag")).toHaveLength(0);
  });
});

describe("Règle 2 — Accent dans un tag", () => {
  test("détecte un accent dans le nom du tag", () => {
    const errors = analyzeSyntax(extractAllTags("{participant_prénom}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "accent_in_tag" })
    );
  });

  test("accepte un accent dans la valeur d'une condition", () => {
    const errors = analyzeSyntax(
      extractAllTags("{?participant_prenom=Hélène}")
    );
    expect(errors.filter((e) => e.rule === "accent_in_tag")).toHaveLength(0);
  });
});

describe("Règle 3 — Majuscule dans un tag", () => {
  test("accepte un tag entièrement en minuscules", () => {
    const errors = analyzeSyntax(extractAllTags("{adf_intitule}"));
    expect(errors.filter((e) => e.rule === "uppercase_in_tag")).toHaveLength(0);
  });

  test("accepte un tag entièrement en majuscules", () => {
    const errors = analyzeSyntax(extractAllTags("{ADF_INTITULE}"));
    expect(errors.filter((e) => e.rule === "uppercase_in_tag")).toHaveLength(0);
  });

  test("accepte une boucle en majuscules", () => {
    const errors = analyzeSyntax(extractAllTags("{#ADF_JOURS}{/ADF_JOURS}"));
    expect(errors.filter((e) => e.rule === "uppercase_in_tag")).toHaveLength(0);
  });

  test("détecte un mélange majuscules/minuscules", () => {
    const errors = analyzeSyntax(extractAllTags("{adf_INTITULE}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "uppercase_in_tag" })
    );
  });

  test("détecte un mélange type CamelCase", () => {
    const errors = analyzeSyntax(extractAllTags("{Adf_Intitule}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "uppercase_in_tag" })
    );
  });

  test("détecte un mélange majuscules/minuscules (ancien test)", () => {
    const errors = analyzeSyntax(extractAllTags("{Participant_Nom}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "uppercase_in_tag" })
    );
  });

  test("ne vérifie pas la casse de la valeur après l'opérateur", () => {
    const errors = analyzeSyntax(extractAllTags("{?adf_type=INTER}"));
    expect(errors.filter((e) => e.rule === "uppercase_in_tag")).toHaveLength(0);
  });

  test("ne vérifie pas la casse du sous-champ", () => {
    const errors = analyzeSyntax(
      extractAllTags("{#participants:HEURES_PRESENCE>0}")
    );
    expect(errors.filter((e) => e.rule === "uppercase_in_tag")).toHaveLength(0);
  });
});

describe("Règle 4 — Boucle de texte non fermée", () => {
  test("détecte une boucle non fermée", () => {
    const errors = analyzeSyntax(extractAllTags("{#adf_jours} contenu"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "unclosed" })
    );
  });

  test("ne signale pas d'erreur quand la boucle est bien fermée", () => {
    const errors = analyzeSyntax(
      extractAllTags("{#adf_jours} contenu {/adf_jours}")
    );
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });

  test("signale la bonne occurrence quand la 3ᵉ boucle n'est pas fermée", () => {
    const text =
      "{#adf_jours}{/adf_jours} {#adf_jours}{/adf_jours} {#adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    const unclosed = errors.find((e) => e.rule === "unclosed");
    expect(unclosed?.occurrence).toBe(3);
    expect(unclosed!.message).toContain("3ᵉ");
  });

  test("n'indique pas de numéro d'occurrence quand le tag n'apparaît qu'une fois", () => {
    const text = "{#adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    const unclosed = errors.find((e) => e.rule === "unclosed");
    expect(unclosed).toBeDefined();
    expect(unclosed!.message).not.toMatch(/\dᵉ/);
  });
});

describe("Règle 5 — Condition non fermée", () => {
  test("détecte une condition non fermée", () => {
    const errors = analyzeSyntax(
      extractAllTags("{?adf_type=INTER} contenu")
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "unclosed" })
    );
  });

  test("ne signale pas d'erreur quand la condition est bien fermée", () => {
    const errors = analyzeSyntax(
      extractAllTags("{?adf_type=INTER} contenu {/adf_type}")
    );
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });
});

describe("Règle 6 — Tag fermant orphelin", () => {
  test("détecte un tag fermant sans ouvrant", () => {
    const errors = analyzeSyntax(extractAllTags("{/adf_jours}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "orphan_closing" })
    );
  });

  test("un tag fermant orphelin ne corrompt pas la pile et ne génère pas de faux croisement", () => {
    const text = `
      {?adf_mode_organisation=test}
        {?adf_type=INTRA}
          {?adf_recettes_annexes}
            {#adf_recettes_annexes}
            {/adf_recettes_annexes}
          {/adf_recettes_annexes}
          {/adf_recettes_annexes}
        {/adf_type}
      {/adf_mode_organisation}
    `;
    const errors = analyzeSyntax(extractAllTags(text));
    const orphans = errors.filter((e) => e.rule === "orphan_closing");
    expect(orphans).toHaveLength(1);
    expect(orphans[0].tag).toContain("{/adf_recettes_annexes}");
    expect(errors.filter((e) => e.rule === "crossing")).toHaveLength(0);
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });

  test("indique l'occurrence sur un tag fermant orphelin", () => {
    const text = "{#adf_jours}{/adf_jours} {/adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    const orphan = errors.find((e) => e.rule === "orphan_closing");
    expect(orphan).toBeDefined();
    expect(orphan!.occurrence).toBe(2);
    expect(orphan!.message).toContain("2ᵉ");
  });
});

describe("Règle 7 — Croisement de boucles/conditions", () => {
  test("détecte un VRAI croisement quand deux paires se chevauchent", () => {
    const text =
      "{#adf_jours} {?adf_intitule=test} {/adf_jours} {/adf_intitule}";
    const errors = analyzeSyntax(extractAllTags(text));
    const hasIssue = errors.some(
      (e) =>
        e.rule === "crossing" ||
        e.rule === "unclosed" ||
        e.rule === "orphan_closing"
    );
    expect(hasIssue).toBe(true);
  });

  test("accepte une imbrication correcte", () => {
    const text =
      "{#adf_jours} {?adf_intitule=test} {/adf_intitule} {/adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "crossing")).toHaveLength(0);
  });
});

describe("Règle 8 — Boucle de tableau avec tag fermant", () => {
  test("détecte un tag fermant pour une boucle de tableau", () => {
    const text = "{##adf_jours} contenu {/adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "table_loop_has_closing" })
    );
  });

  test("ne signale pas d'erreur pour une boucle texte avec fermant", () => {
    const text = "{#adf_jours} contenu {/adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(
      errors.filter((e) => e.rule === "table_loop_has_closing")
    ).toHaveLength(0);
  });
});

describe("Règle 9 — Accolade non fermée", () => {
  test("détecte une accolade non fermée", () => {
    const errors = analyzeSyntax(
      extractAllTags("texte {adf_intitule et suite")
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "unclosed_brace" })
    );
  });

  test("ne signale pas d'erreur quand toutes les accolades sont fermées", () => {
    const errors = analyzeSyntax(
      extractAllTags("texte {participant_nom} suite")
    );
    expect(errors.filter((e) => e.rule === "unclosed_brace")).toHaveLength(0);
  });
});

describe("Règle 10 — Tag vide", () => {
  test("détecte un tag vide {}", () => {
    const errors = analyzeSyntax(extractAllTags("{}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "empty_tag" })
    );
  });

  test("détecte un tag vide {#}", () => {
    const errors = analyzeSyntax(extractAllTags("{#}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "empty_tag" })
    );
  });
});

describe("Règle 11 — Condition avec opérateur invalide", () => {
  test("détecte un opérateur invalide ~", () => {
    const errors = analyzeSyntax(extractAllTags("{?tag~valeur}"));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "invalid_operator" })
    );
  });

  test("accepte les opérateurs valides", () => {
    for (const op of ["=", "==", "!=", "<>", ">", ">=", "<", "<="]) {
      const errors = analyzeSyntax(
        extractAllTags(`{?adf_type${op}INTER}`)
      );
      expect(errors.filter((e) => e.rule === "invalid_operator")).toHaveLength(
        0
      );
    }
  });
});

describe("Règle 12 — Boucle conditionnelle sans opérateur", () => {
  test("détecte une boucle conditionnelle sans opérateur", () => {
    const errors = analyzeSyntax(
      extractAllTags("{#participants:heures_presence}")
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "conditional_loop_no_operator" })
    );
  });

  test("accepte une boucle conditionnelle avec opérateur", () => {
    const errors = analyzeSyntax(
      extractAllTags("{#participants:heures_presence>0}")
    );
    expect(
      errors.filter((e) => e.rule === "conditional_loop_no_operator")
    ).toHaveLength(0);
  });
});

describe("Décodage des entités XML", () => {
  test("ne produit pas de faux positif invalid_operator pour &gt; dans le XML Word", () => {
    const xml = `<w:p><w:r><w:t>{?adf_duree_jours&gt;0}{/adf_duree_jours}</w:t></w:r></w:p>`;
    const text = extractTextFromXml(xml);
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "invalid_operator")).toHaveLength(0);
  });

  test("ne produit pas de faux positif invalid_operator pour &lt; dans le XML Word", () => {
    const xml = `<w:p><w:r><w:t>{?adf_duree_jours&lt;10}{/adf_duree_jours}</w:t></w:r></w:p>`;
    const text = extractTextFromXml(xml);
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "invalid_operator")).toHaveLength(0);
  });

  test("décode &gt; en > avant extraction (le tag est bien reconnu)", () => {
    const xml = `<w:p><w:r><w:t>{?adf_duree_jours&gt;0}</w:t></w:r></w:p>`;
    const text = extractTextFromXml(xml);
    expect(text).toBe("{?adf_duree_jours>0}");
  });

  test("ne signale aucune erreur sur un document XML bien formé avec &gt;", () => {
    const xml = `<w:body>
      <w:p><w:r><w:t>{?adf_duree_jours&gt;0} présent {/adf_duree_jours}</w:t></w:r></w:p>
    </w:body>`;
    const text = extractTextFromXml(xml);
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors).toHaveLength(0);
  });
});

describe("Suffixe * sur les tags fermants (syntaxe Dendreo)", () => {
  test("associe correctement {#semaines,k} avec {/semaines*}", () => {
    const text = "{#semaines,k} contenu {/semaines*}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "orphan_closing")).toHaveLength(0);
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });

  test("associe {#nom} avec {/nom*} même sans compteur", () => {
    const text = "{#participants} {/participants*}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "orphan_closing")).toHaveLength(0);
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });

  test("associe {?condition} avec {/condition*}", () => {
    const text = "{?adf_type=INTER} contenu {/adf_type*}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors.filter((e) => e.rule === "orphan_closing")).toHaveLength(0);
    expect(errors.filter((e) => e.rule === "unclosed")).toHaveLength(0);
  });
});

describe("Règle 8 — table_loop_has_closing contextuelle", () => {
  test("ne signale pas table_loop_has_closing quand les {/nom} ferment des conditions {?nom...}", () => {
    const text = `
      {?fact_reglements=1}
        {##fact_reglements}
      {/fact_reglements}
      {?fact_reglements>1}
        {##fact_reglements}
      {/fact_reglements}
    `;
    const errors = analyzeSyntax(extractAllTags(text));
    const tableErrors = errors.filter((e) => e.rule === "table_loop_has_closing");
    expect(tableErrors).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test("signale table_loop_has_closing seulement pour les {/nom} excédentaires", () => {
    const text = `
      {?fact_reglements=1}
        {##fact_reglements}
      {/fact_reglements}
      {/fact_reglements}
    `;
    const errors = analyzeSyntax(extractAllTags(text));
    const tableErrors = errors.filter((e) => e.rule === "table_loop_has_closing");
    expect(tableErrors).toHaveLength(1);
  });

  test("signale table_loop_has_closing quand {/nom} existe sans aucun ouvrant {#nom} ni {?nom}", () => {
    const text = "{##adf_jours} contenu {/adf_jours}";
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors).toContainEqual(
      expect.objectContaining({ rule: "table_loop_has_closing" })
    );
  });
});

describe("Bug 2 — unclosed vs crossing", () => {
  test("signale unclosed (pas crossing) quand des tags ouvrants non fermés précèdent un closing profond", () => {
    const text = `
      {?fact_multi_adfs=non}
        {?adf_type_sans=intra}
        {?adf_type_sans=inter}
        {?fact_participants>1}
      {/fact_multi_adfs}
    `;
    const errors = analyzeSyntax(extractAllTags(text));

    const unclosed = errors.filter((e) => e.rule === "unclosed");
    expect(unclosed).toHaveLength(3);
    expect(unclosed.map((e) => e.tag)).toEqual(
      expect.arrayContaining([
        "{?adf_type_sans=intra}",
        "{?adf_type_sans=inter}",
        "{?fact_participants>1}",
      ])
    );

    const crossings = errors.filter((e) => e.rule === "crossing");
    expect(crossings).toHaveLength(0);
  });

  test("un tag fermant orphelin ne corrompt pas la pile (rappel fix1)", () => {
    const text = `
      {?adf_mode_organisation=test}
        {?adf_type=INTRA}
          {?adf_recettes_annexes}
            {#adf_recettes_annexes}
            {/adf_recettes_annexes}
          {/adf_recettes_annexes}
          {/adf_recettes_annexes}
        {/adf_type}
      {/adf_mode_organisation}
    `;
    const errors = analyzeSyntax(extractAllTags(text));
    const orphans = errors.filter((e) => e.rule === "orphan_closing");
    expect(orphans).toHaveLength(1);
    const crossings = errors.filter((e) => e.rule === "crossing");
    expect(crossings).toHaveLength(0);
    const unclosed = errors.filter((e) => e.rule === "unclosed");
    expect(unclosed).toHaveLength(0);
  });
});

describe("Document bien formé", () => {
  test("ne signale aucune erreur sur un document complet sans erreur", () => {
    const text = `
      {?ent_particulier=0}
        {ent_raison_sociale}
        {#participants}
          {participant_nom} {participant_prenom}
          {?participant_heures_presence>0}
            Présent
          {/participant_heures_presence}
        {/participants}
      {/ent_particulier}
    `;
    const errors = analyzeSyntax(extractAllTags(text));
    expect(errors).toHaveLength(0);
  });
});

import { describe, test, expect } from "bun:test";
import { TAG_PATTERN } from "../lib/engine/tag-pattern";

describe("TAG_PATTERN", () => {
  test.each([
    ["{?tag>=0}", ">="],
    ["{?tag<=5}", "<="],
    ["{?tag<>test}", "<>"],
    ["{?tag!=test}", "!="],
    ["{?tag==test}", "=="],
    ["{?tag>0}", ">"],
    ["{?tag<10}", "<"],
    ["{?tag=test}", "="],
    ["{?tag=[80;100]}", "intervalle"],
    ["{?tag=]80;100[}", "intervalle ouvert"],
    ["{?tag=*BTP*}", "wildcard"],
    ["{?tag=A|B}", "OU"],
    ["{?tag!=A+B}", "ET"],
    ["{?tag}", "sans opérateur"],
    ["{#boucle:champ>=0}", "boucle conditionnelle"],
    ["{#boucle,i:champ>0}", "avec compteur"],
    ["{##tableau}", "boucle tableau"],
    ["{adf_intitule}", "tag simple"],
    ["{#adf_jours}", "boucle ouvrante"],
    ["{/adf_jours}", "boucle fermante"],
    ["{?adf_intitule=test}", "condition ouvrante"],
  ])("reconnaît le tag %s (%s)", (tag) => {
    const regex = new RegExp(TAG_PATTERN.source);
    expect(tag).toMatch(regex);
  });

  test("reconnaît un tag fermant avec suffixe *", () => {
    const regex = new RegExp(TAG_PATTERN.source);
    expect("{/semaines*}").toMatch(regex);
  });

  test("reconnaît un tag fermant simple sans *", () => {
    const regex = new RegExp(TAG_PATTERN.source);
    expect("{/semaines}").toMatch(regex);
  });

  test("ne matche pas une chaîne qui n'est pas un tag", () => {
    const regex = new RegExp(TAG_PATTERN.source);
    expect("pas un tag").not.toMatch(regex);
    expect("{123}").not.toMatch(regex);
    expect("{}").not.toMatch(regex);
  });
});

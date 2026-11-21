import { describe, expect, it } from "vitest";
import { OPEN_STAGES, STAGE_KEYS, defaultProbability, isClosedStage, stageInfo, stageName } from "./stages";

describe("stages", () => {
  it("are in pipeline order", () => {
    expect(STAGE_KEYS).toEqual(["new", "qualified", "proposal", "negotiation", "won", "lost"]);
    expect(OPEN_STAGES).toEqual(["new", "qualified", "proposal", "negotiation"]);
  });

  it("have their usual probabilities", () => {
    expect(STAGE_KEYS.map(defaultProbability)).toEqual([10, 25, 50, 75, 100, 0]);
  });

  it("are colored by meaning", () => {
    expect(STAGE_KEYS.map((s) => stageInfo(s).color)).toEqual([
      "#118AB2",
      "#FFC145",
      "#F78C6B",
      "#073B4C",
      "#06D6A0",
      "#CDD8DB",
    ]);
  });

  it("have names, and Won and Lost are closed", () => {
    expect(stageName("negotiation")).toBe("Negotiation");
    expect(STAGE_KEYS.filter(isClosedStage)).toEqual(["won", "lost"]);
  });
});

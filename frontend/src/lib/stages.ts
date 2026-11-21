export type Stage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface StageInfo {
  key: Stage;
  name: string;
  /** The fill for dots, bars and chart marks. */
  color: string;
  /** Badge class: a pale tint with ink of the same hue. */
  badge: string;
  probability: number;
  open: boolean;
}

// Colored by meaning (spec, Concerns 3). Raspberry is kept for things that need attention.
export const STAGES: StageInfo[] = [
  { key: "new", name: "New", color: "#118AB2", badge: "badge-cerulean", probability: 10, open: true },
  { key: "qualified", name: "Qualified", color: "#FFC145", badge: "badge-marigold", probability: 25, open: true },
  { key: "proposal", name: "Proposal", color: "#F78C6B", badge: "badge-coral", probability: 50, open: true },
  { key: "negotiation", name: "Negotiation", color: "#073B4C", badge: "badge-midnight", probability: 75, open: true },
  { key: "won", name: "Won", color: "#06D6A0", badge: "badge-green", probability: 100, open: false },
  { key: "lost", name: "Lost", color: "#CDD8DB", badge: "badge-mist", probability: 0, open: false },
];

export const STAGE_KEYS: Stage[] = STAGES.map((s) => s.key);
export const OPEN_STAGES: Stage[] = STAGES.filter((s) => s.open).map((s) => s.key);

const BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<Stage, StageInfo>;

export function stageInfo(stage: Stage): StageInfo {
  return BY_KEY[stage];
}

export function stageName(stage: Stage): string {
  return BY_KEY[stage].name;
}

export function defaultProbability(stage: Stage): number {
  return BY_KEY[stage].probability;
}

export function isOpenStage(stage: Stage): boolean {
  return BY_KEY[stage].open;
}

export function isClosedStage(stage: Stage): boolean {
  return !BY_KEY[stage].open;
}

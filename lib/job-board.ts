import { REPAIR_STAGES, type RepairStage } from "@/lib/definitions";

/**
 * The workshop dashboard's job board: where a car is today, derived from
 * the booking status and the repair tracker (0024) rather than stored.
 *
 *   arriving     booked, not checked in yet (confirmed, no stage; or an
 *                old pending booking still awaiting confirmation)
 *   in_workshop  checked in and being worked on (received .. quality_check)
 *   ready        ready_for_pickup, waiting for its owner
 *   done         completed
 *
 * Cancelled jobs and unfinished checkouts (pending_payment) are off the
 * board.
 */
export const BOARD_COLUMNS = ["arriving", "in_workshop", "ready", "done"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

type BoardJob = { status: string; repair_stage: string | null };

function stageIndex(stage: string | null) {
  return stage ? REPAIR_STAGES.indexOf(stage as RepairStage) : -1;
}

export function boardColumn(job: BoardJob): BoardColumn | null {
  switch (job.status) {
    case "completed":
      return "done";
    case "pending":
      return "arriving";
    case "confirmed": {
      const index = stageIndex(job.repair_stage);
      if (index < 0) return "arriving";
      return REPAIR_STAGES[index] === "ready_for_pickup" ? "ready" : "in_workshop";
    }
    default:
      return null;
  }
}

/**
 * The one-click action on a card, moving the car one step along:
 * confirm an old pending booking, check a car in, advance its repair
 * stage, or hand it back (complete). Nothing once it's done.
 */
export type NextStep =
  | { kind: "confirm" }
  | { kind: "stage"; stage: RepairStage }
  | { kind: "complete" };

export function nextStep(job: BoardJob): NextStep | null {
  if (job.status === "pending") return { kind: "confirm" };
  if (job.status !== "confirmed") return null;
  const index = stageIndex(job.repair_stage);
  if (index < 0) return { kind: "stage", stage: REPAIR_STAGES[0] };
  if (index === REPAIR_STAGES.length - 1) return { kind: "complete" };
  return { kind: "stage", stage: REPAIR_STAGES[index + 1] };
}

/** Groups jobs into board columns, each in start-time order. */
export function groupBoard<T extends BoardJob & { id: string; start_time: string }>(jobs: T[]) {
  const columns: Record<BoardColumn, T[]> = { arriving: [], in_workshop: [], ready: [], done: [] };
  const seen = new Set<string>();
  for (const job of [...jobs].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    const column = boardColumn(job);
    if (column) columns[column].push(job);
  }
  return columns;
}

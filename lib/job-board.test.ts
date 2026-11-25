import { describe, expect, it } from "vitest";
import { boardColumn, groupBoard, nextStep } from "./job-board";

const job = (status: string, repair_stage: string | null = null) => ({ status, repair_stage });

describe("boardColumn", () => {
  it("puts booked cars not yet checked in under arriving", () => {
    expect(boardColumn(job("confirmed"))).toBe("arriving");
    expect(boardColumn(job("pending"))).toBe("arriving");
  });

  it("keeps checked-in cars in the workshop until they are ready", () => {
    for (const stage of ["received", "diagnosis", "in_repair", "quality_check"]) {
      expect(boardColumn(job("confirmed", stage))).toBe("in_workshop");
    }
    expect(boardColumn(job("confirmed", "ready_for_pickup"))).toBe("ready");
  });

  it("files completed jobs as done and drops the rest", () => {
    expect(boardColumn(job("completed", "ready_for_pickup"))).toBe("done");
    expect(boardColumn(job("cancelled"))).toBeNull();
    expect(boardColumn(job("pending_payment"))).toBeNull();
  });
});

describe("nextStep", () => {
  it("walks a car through the workshop one step at a time", () => {
    expect(nextStep(job("pending"))).toEqual({ kind: "confirm" });
    expect(nextStep(job("confirmed"))).toEqual({ kind: "stage", stage: "received" });
    expect(nextStep(job("confirmed", "received"))).toEqual({ kind: "stage", stage: "diagnosis" });
    expect(nextStep(job("confirmed", "quality_check"))).toEqual({ kind: "stage", stage: "ready_for_pickup" });
    expect(nextStep(job("confirmed", "ready_for_pickup"))).toEqual({ kind: "complete" });
  });

  it("offers nothing once the job is closed", () => {
    expect(nextStep(job("completed"))).toBeNull();
    expect(nextStep(job("cancelled"))).toBeNull();
  });
});

describe("groupBoard", () => {
  it("sorts each column by start time and ignores duplicates", () => {
    const a = { id: "a", start_time: "2026-11-25T10:00:00Z", ...job("confirmed") };
    const b = { id: "b", start_time: "2026-11-25T08:00:00Z", ...job("confirmed") };
    const c = { id: "c", start_time: "2026-11-24T08:00:00Z", ...job("confirmed", "in_repair") };
    const board = groupBoard([a, b, c, a]);
    expect(board.arriving.map((item) => item.id)).toEqual(["b", "a"]);
    expect(board.in_workshop.map((item) => item.id)).toEqual(["c"]);
    expect(board.ready).toEqual([]);
  });
});

"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoveRight } from "lucide-react";
import { moveAppointment, type MoveAppointmentResult } from "@/app/actions/appointments";
import { dropStartMinutes, minutesToTime } from "@/lib/calendar-grid";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";

type D = Dictionary["garageCalendar"];
type MoveError = Extract<MoveAppointmentResult, { ok: false }>["error"];

type Target = {
  date: string;
  startMin: number;
  // Set when dropped in a mechanic's column (per-mechanic day view).
  mechanicId?: string;
  mechanicName?: string;
  valid: boolean;
};

type Drag = {
  pointerId: number;
  block: HTMLElement;
  scroller: HTMLElement;
  startX: number;
  startY: number;
  grabOffsetY: number;
  active: boolean;
  id: string;
  durationMin: number;
  mechanicId: string;
  label: string;
  notify: boolean;
  originDate: string;
  originStartMin: number;
  target: Target | null;
  // The window listeners for this drag, kept so the exact same functions
  // can be removed (handlers recreated by a later render wouldn't match).
  detach: () => void;
};

type Ghost = { left: number; top: number; width: number; height: number; text: string; valid: boolean };

type Pending = {
  id: string;
  durationMin: number;
  mechanicId: string;
  label: string;
  notify: boolean;
  target: Target;
};

const noopSubscribe = () => () => {};

const DRAG_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 48;
const AUTOSCROLL_STEP_PX = 14;

/**
 * Drag-and-drop rescheduling for the server-rendered time grid. Blocks
 * carry data-drag-* attributes (only open jobs do); columns carry their date
 * and, in the per-mechanic day view, their mechanic.
 *
 * - Mouse and pen only. On touch, a drag would fight scrolling the grid;
 *   the appointment panel's Reschedule button covers phones (and keyboards).
 * - A press that doesn't move past a few pixels is still a normal click
 *   (opens the appointment panel).
 * - Nothing is saved on drop: a small confirm panel says what will change
 *   (and that the client gets an email), then moveAppointment does it
 *   atomically (0041).
 * - Staff who aren't the owner can move times but not hand a job to
 *   another mechanic (same rule as Assign mechanic); such drops show as not
 *   allowed.
 */
export function CalendarDragLayer({
  lang,
  d,
  canReassign,
  children,
}: {
  lang: Locale;
  d: D;
  canReassign: boolean;
  children: ReactNode;
}) {
  const dragRef = useRef<Drag | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<MoveError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const dimmedRef = useRef<HTMLElement | null>(null);
  // Portals need document: false on the server, true once hydrated.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const formatDay = (date: string) =>
    dateKeyToDisplayDate(date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      timeZone: APP_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  function restoreBlock() {
    if (dimmedRef.current) {
      dimmedRef.current.style.opacity = "";
      dimmedRef.current = null;
    }
    document.body.style.cursor = "";
  }

  function reset() {
    dragRef.current?.detach();
    restoreBlock();
    setGhost(null);
    setPending(null);
    setError(null);
    dragRef.current = null;
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Esc cancels a drag in progress or the confirm panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dragRef.current?.active || pending) {
        event.stopPropagation();
        reset();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // reset only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function geometry(scroller: HTMLElement) {
    return {
      rangeStart: Number(scroller.dataset.rangeStart),
      hourPx: Number(scroller.dataset.hourPx),
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch" || pending || saving) return;
    const block = (event.target as HTMLElement).closest<HTMLElement>("[data-drag-appt]");
    const column = block?.closest<HTMLElement>("[data-grid-column]");
    const scroller = block?.closest<HTMLElement>("[data-grid-scroll]");
    if (!block || !column || !scroller) return;

    const { rangeStart, hourPx } = geometry(scroller);
    const blockRect = block.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    const durationMin = Number(block.dataset.dragDuration);

    dragRef.current = {
      pointerId: event.pointerId,
      block,
      scroller,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetY: event.clientY - blockRect.top,
      active: false,
      id: block.dataset.dragAppt!,
      durationMin,
      mechanicId: block.dataset.dragMechanic ?? "",
      label: block.dataset.dragLabel ?? "",
      notify: block.dataset.dragNotify === "1",
      originDate: column.dataset.colDate!,
      originStartMin: dropStartMinutes({
        // The block is drawn 1px below its true start (inset).
        blockTopPx: blockRect.top - columnRect.top - 1,
        rangeStartMin: rangeStart,
        hourPx,
        durationMin,
        snapMinutes: 5,
      }),
      target: null,
      detach: () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      },
    };

    const move = (pointer: globalThis.PointerEvent) => handleMove(pointer);
    const up = (pointer: globalThis.PointerEvent) => handleUp(pointer);
    const cancel = () => {
      dragRef.current?.detach();
      reset();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  function handleMove(event: globalThis.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      drag.block.style.opacity = "0.35";
      dimmedRef.current = drag.block;
      document.body.style.cursor = "grabbing";
    }
    event.preventDefault();

    // Scroll the grid when dragging near its edges.
    const scrollRect = drag.scroller.getBoundingClientRect();
    if (event.clientY < scrollRect.top + AUTOSCROLL_EDGE_PX) drag.scroller.scrollBy(0, -AUTOSCROLL_STEP_PX);
    else if (event.clientY > scrollRect.bottom - AUTOSCROLL_EDGE_PX) drag.scroller.scrollBy(0, AUTOSCROLL_STEP_PX);
    if (event.clientX < scrollRect.left + AUTOSCROLL_EDGE_PX) drag.scroller.scrollBy(-AUTOSCROLL_STEP_PX, 0);
    else if (event.clientX > scrollRect.right - AUTOSCROLL_EDGE_PX) drag.scroller.scrollBy(AUTOSCROLL_STEP_PX, 0);

    const under = document.elementFromPoint(event.clientX, event.clientY);
    const column = under?.closest<HTMLElement>("[data-grid-column]");
    if (!column || !drag.scroller.contains(column)) return;

    const { rangeStart, hourPx } = geometry(drag.scroller);
    const columnRect = column.getBoundingClientRect();
    const startMin = dropStartMinutes({
      blockTopPx: event.clientY - drag.grabOffsetY - columnRect.top,
      rangeStartMin: rangeStart,
      hourPx,
      durationMin: drag.durationMin,
    });
    const columnMechanic = column.dataset.colMechanic;
    const valid = canReassign || !columnMechanic || columnMechanic === drag.mechanicId;

    drag.target = {
      date: column.dataset.colDate!,
      startMin,
      mechanicId: columnMechanic,
      mechanicName: column.dataset.colMechanicName,
      valid,
    };
    setGhost({
      left: columnRect.left + 2,
      width: columnRect.width - 4,
      top: columnRect.top + ((startMin - rangeStart) / 60) * hourPx,
      height: Math.max((drag.durationMin / 60) * hourPx, 22),
      text: `${minutesToTime(startMin)}–${minutesToTime(startMin + drag.durationMin)}`,
      valid,
    });
  }

  function handleUp(event: globalThis.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.detach();
    if (!drag.active) {
      // A plain click: let the link open the appointment panel.
      dragRef.current = null;
      return;
    }

    // The click that follows a drag must not open the appointment.
    window.addEventListener(
      "click",
      (click) => {
        click.preventDefault();
        click.stopPropagation();
      },
      { capture: true, once: true }
    );

    const target = drag.target;
    const unchanged =
      !target ||
      (target.date === drag.originDate &&
        target.startMin === drag.originStartMin &&
        (!target.mechanicId || target.mechanicId === drag.mechanicId));
    if (!target || !target.valid || unchanged) {
      if (target && !target.valid) setToast(d.moveErrors["owner-only"]);
      reset();
      return;
    }
    setPending({
      id: drag.id,
      durationMin: drag.durationMin,
      mechanicId: drag.mechanicId,
      label: drag.label,
      notify: drag.notify,
      target,
    });
  }

  function confirmMove() {
    if (!pending) return;
    const { target } = pending;
    startSaving(async () => {
      const result = await moveAppointment({
        lang,
        id: pending.id,
        date: target.date,
        time: minutesToTime(target.startMin),
        mechanicId: target.mechanicId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const when = `${formatDay(target.date)} ${minutesToTime(target.startMin)}`;
      let message = d.moved.replace("{when}", when);
      if (result.mechanicChanged && result.mechanicName && !target.mechanicId) {
        message += ` ${d.movedNowWith.replace("{mechanic}", result.mechanicName)}`;
      }
      reset();
      setToast(message);
    });
  }

  const pendingWhen = pending
    ? `${formatDay(pending.target.date)} ${minutesToTime(pending.target.startMin)}`
    : "";
  const pendingText = pending
    ? (pending.target.mechanicName && pending.target.mechanicId !== pending.mechanicId
        ? d.moveConfirmWith.replace("{mechanic}", pending.target.mechanicName)
        : d.moveConfirm
      )
        .replace("{job}", pending.label)
        .replace("{when}", pendingWhen)
    : "";

  return (
    <div onPointerDown={onPointerDown} className="contents">
      {children}
      {mounted &&
        createPortal(
          <>
            {ghost && (
              <div
                aria-hidden
                className={`pointer-events-none fixed z-[60] flex items-start rounded-md border-2 border-dashed px-1.5 py-1 text-[11px] font-semibold tabular-nums shadow-lg ${
                  ghost.valid
                    ? "border-brand-600 bg-brand-50/90 text-brand-700 dark:border-brand-400 dark:bg-brand-950/80 dark:text-brand-300"
                    : "border-red-500 bg-red-50/90 text-red-700 dark:bg-red-950/80 dark:text-red-300"
                }`}
                style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }}
              >
                {ghost.valid ? ghost.text : d.moveErrors["owner-only"]}
              </div>
            )}
            {pending && (
              <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="move-confirm-text"
                className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p id="move-confirm-text" className="flex items-start gap-2 text-sm text-black dark:text-zinc-50">
                  <MoveRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span>{pendingText}</span>
                </p>
                {pending.notify && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.moveNotify}</p>
                )}
                {error && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {d.moveErrors[error]}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={saving}
                    className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {d.moveCancel}
                  </button>
                  <button
                    type="button"
                    onClick={confirmMove}
                    disabled={saving}
                    autoFocus
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
                  >
                    {saving ? d.moving : d.moveAction}
                  </button>
                </div>
              </div>
            )}
            <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[65] flex justify-center">
              {toast && !pending && (
                <p className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
                  {toast}
                </p>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

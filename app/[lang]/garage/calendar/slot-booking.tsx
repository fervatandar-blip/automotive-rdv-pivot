"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { WalkInModal, type WalkInModalHandle } from "@/components/quick-walk-in-modal";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Makes the server-rendered time grid's empty slots bookable. Each slot is a
 * real <button data-slot-date data-slot-time> (keyboard and screen-reader
 * reachable); one delegated click handler opens a single shared
 * new-appointment modal preset to that date and time, instead of mounting a
 * dialog per slot.
 */
export function SlotBookingSurface({
  lang,
  d,
  children,
}: {
  lang: Locale;
  d: Dictionary["walkIn"];
  children: ReactNode;
}) {
  const modalRef = useRef<WalkInModalHandle>(null);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-date]");
    const date = slot?.dataset.slotDate;
    const time = slot?.dataset.slotTime;
    if (!date || !time) return;
    modalRef.current?.open({ date, time });
  }

  return (
    <div onClick={onClick} className="contents">
      {children}
      <WalkInModal ref={modalRef} lang={lang} d={d} />
    </div>
  );
}

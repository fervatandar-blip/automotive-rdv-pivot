import { minutesIntoDateInAppZone, zonedDateTimeToUtc } from "@/lib/timezone";

export type AvailabilityWindow = {
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
};

export type BookedRange = {
  start: Date;
  end: Date;
  // Which mechanic (anonymously numbered, see get_booked_ranges in 0037)
  // holds this booking. Ranges without a lane are each treated as their
  // own mechanic.
  lane?: number;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export type BlockedRange = {
  start: Date;
  end: Date;
};

/**
 * Removes garage-wide blocked time (availability_blocks, 0039) from a
 * date's wall-clock opening windows, splitting a window around a block in
 * its middle: 08:00-12:00 minus 10:00-10:30 -> 08:00-10:00 + 10:30-12:00.
 * Slots are then stepped from each remaining piece's start, so the first
 * slot after a block starts exactly when the block ends.
 * Blocks may come from any zone-day; only the part on `date` applies.
 */
export function subtractBlockedRanges({
  date,
  windows,
  blocks,
}: {
  date: string; // "YYYY-MM-DD"
  windows: AvailabilityWindow[];
  blocks: BlockedRange[];
}): AvailabilityWindow[] {
  if (blocks.length === 0) return windows;

  const blocked = blocks
    .map((block) => ({
      start: minutesIntoDateInAppZone(block.start, date),
      end: minutesIntoDateInAppZone(block.end, date),
    }))
    .filter((block) => block.end > block.start);

  const result: AvailabilityWindow[] = [];
  for (const window of windows) {
    let pieces = [{ start: timeToMinutes(window.start_time), end: timeToMinutes(window.end_time) }];
    for (const block of blocked) {
      pieces = pieces.flatMap((piece) => {
        if (block.end <= piece.start || block.start >= piece.end) return [piece];
        return [
          { start: piece.start, end: block.start },
          { start: block.end, end: piece.end },
        ].filter((part) => part.end > part.start);
      });
    }
    for (const piece of pieces) {
      result.push({
        start_time: `${minutesToTime(piece.start)}:00`,
        end_time: `${minutesToTime(piece.end)}:00`,
      });
    }
  }
  return result;
}

/**
 * Steps through each availability window in durationMinutes increments,
 * dropping slots that have already passed or for which no mechanic is
 * free: a slot is bookable while fewer than `capacity` mechanics (the
 * garage's bookable mechanics, 0037) have a booking overlapping it.
 * `date` and the window times are wall-clock values in APP_TIME_ZONE (see
 * lib/timezone.ts); the comparison against bookings and `now` happens on
 * real instants, so the result doesn't depend on the server's own zone.
 */
export function computeAvailableSlots({
  date,
  windows,
  durationMinutes,
  bookedRanges,
  capacity = 1,
  now = new Date(),
}: {
  date: string; // "YYYY-MM-DD"
  windows: AvailabilityWindow[];
  durationMinutes: number;
  bookedRanges: BookedRange[];
  capacity?: number;
  now?: Date;
}): string[] {
  const slots: string[] = [];
  if (capacity < 1) return slots;

  for (const window of windows) {
    const windowStart = timeToMinutes(window.start_time);
    const windowEnd = timeToMinutes(window.end_time);

    for (
      let slotStart = windowStart;
      slotStart + durationMinutes <= windowEnd;
      slotStart += durationMinutes
    ) {
      const slotEnd = slotStart + durationMinutes;
      const slotStartDate = zonedDateTimeToUtc(date, minutesToTime(slotStart));
      const slotEndDate = zonedDateTimeToUtc(date, minutesToTime(slotEnd));

      if (slotStartDate <= now) continue;

      const busyLanes = new Set(
        bookedRanges
          .map((range, index) => ({ range, key: range.lane ?? `range-${index}` }))
          .filter(({ range }) => slotStartDate < range.end && slotEndDate > range.start)
          .map(({ key }) => key)
      );

      if (busyLanes.size < capacity) {
        slots.push(minutesToTime(slotStart));
      }
    }
  }

  // Windows can't overlap (availability_no_overlap, 0035), but overrides or
  // legacy rows could still produce the same start twice; never offer a
  // duplicate slot, and always list them in time order regardless of the
  // order windows arrived in.
  return [...new Set(slots)].sort();
}

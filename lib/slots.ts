export type AvailabilityWindow = {
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
};

export type BookedRange = {
  start: Date;
  end: Date;
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

/**
 * Steps through each availability window in durationMinutes increments,
 * dropping slots that overlap an existing booking or have already passed.
 */
export function computeAvailableSlots({
  date,
  windows,
  durationMinutes,
  bookedRanges,
  now = new Date(),
}: {
  date: string; // "YYYY-MM-DD"
  windows: AvailabilityWindow[];
  durationMinutes: number;
  bookedRanges: BookedRange[];
  now?: Date;
}): string[] {
  const slots: string[] = [];

  for (const window of windows) {
    const windowStart = timeToMinutes(window.start_time);
    const windowEnd = timeToMinutes(window.end_time);

    for (
      let slotStart = windowStart;
      slotStart + durationMinutes <= windowEnd;
      slotStart += durationMinutes
    ) {
      const slotEnd = slotStart + durationMinutes;
      const slotStartDate = new Date(`${date}T${minutesToTime(slotStart)}:00`);
      const slotEndDate = new Date(`${date}T${minutesToTime(slotEnd)}:00`);

      if (slotStartDate <= now) continue;

      const overlaps = bookedRanges.some(
        (range) => slotStartDate < range.end && slotEndDate > range.start
      );

      if (!overlaps) {
        slots.push(minutesToTime(slotStart));
      }
    }
  }

  return slots;
}

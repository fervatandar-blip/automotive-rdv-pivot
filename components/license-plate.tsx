/**
 * A number-plate badge: blue EU band on the left, the plate as the owner
 * typed it (spacing and dashes kept -- "LU-1234" reads better than the
 * normalized "LU1234" used for search). No country letter in the band: the
 * plate may be Luxembourgish, French, Belgian or German and we don't store
 * which. Stays light in dark mode on purpose -- it depicts a physical plate.
 */
export function LicensePlate({ plate, label }: { plate: string; label: string }) {
  return (
    <span
      aria-label={`${label} ${plate}`}
      className="inline-flex shrink-0 items-stretch overflow-hidden rounded-[4px] border border-zinc-800 bg-white text-xs leading-none dark:border-zinc-500"
    >
      <span aria-hidden className="w-2 bg-[#003399]" />
      <span
        aria-hidden
        className="px-1.5 py-1 font-mono font-semibold uppercase tracking-wider text-black"
      >
        {plate}
      </span>
    </span>
  );
}

"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteVehicle } from "@/app/actions/vehicles";
import { DialogShell } from "@/components/dialog-shell";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const ICON_BUTTON =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400";

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-9 items-center rounded-full bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500/90 dark:hover:bg-red-500"
    >
      {label}
    </button>
  );
}

/**
 * Trash icon -> confirm dialog. Past bookings survive a delete
 * (appointments.vehicle_id is ON DELETE SET NULL) but no longer show the
 * vehicle, which the dialog says plainly. The page revalidates on success,
 * removing the card (and this dialog with it).
 */
export function DeleteVehicleButton({
  vehicleId,
  vehicleName,
  d,
}: {
  vehicleId: string;
  vehicleName: string;
  d: Dictionary["vehicles"];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { lang } = useParams<{ lang: string }>();
  const title = d.deleteVehicleNamed.replace("{vehicle}", vehicleName);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={title}
        title={d.delete}
        className={ICON_BUTTON}
      >
        <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <DialogShell dialogRef={dialogRef} title={title} closeLabel={d.form.close}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-muted">{d.deleteConfirm}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-ink hover:bg-subtle"
            >
              {d.keep}
            </button>
            <form action={deleteVehicle}>
              <input type="hidden" name="id" value={vehicleId} />
              <input type="hidden" name="lang" value={lang} />
              <ConfirmButton label={d.deleteYes} />
            </form>
          </div>
        </div>
      </DialogShell>
    </>
  );
}

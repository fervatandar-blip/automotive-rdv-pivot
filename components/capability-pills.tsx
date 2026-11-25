import { BatteryCharging, Siren, Truck, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Capabilities = { ev_capable: boolean; mobile_service: boolean; emergency_service: boolean };

/** What a workshop offers beyond the workshop itself, as neutral pills. */
export function capabilityList(garage: Capabilities, labels: Dictionary["garageOnboarding"]) {
  return [
    garage.ev_capable && { key: "ev", icon: BatteryCharging, label: labels.evCapableShort },
    garage.mobile_service && { key: "mobile", icon: Truck, label: labels.mobileServiceShort },
    garage.emergency_service && { key: "emergency", icon: Siren, label: labels.emergencyServiceShort },
  ].filter((item): item is { key: string; icon: LucideIcon; label: string } => Boolean(item));
}

export function CapabilityPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
      {label}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { ArrowRight, MapPin, Navigation, X } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { withBookingVehicle } from "@/lib/booking-vehicle";
import { directionsUrl } from "@/lib/maps";
import { monogram } from "@/lib/monogram";
import { CLIENT_CARD, CLIENT_PRIMARY_BUTTON, CLIENT_TINTED_PILL } from "@/lib/client-ui";

export type DiscoveryGarage = {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  // Pre-formatted on the server ("2,4 km") when the client shared a location.
  distance: string | null;
};

export type DiscoveryMapLabels = {
  map: string;
  book: string;
  directions: string;
  close: string;
};

function FitBounds({ garages }: { garages: DiscoveryGarage[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || garages.length === 0) return;

    if (garages.length === 1) {
      map.setCenter({ lat: garages[0].latitude, lng: garages[0].longitude });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const garage of garages) {
      bounds.extend({ lat: garage.latitude, lng: garage.longitude });
    }
    map.fitBounds(bounds, 48);
  }, [map, garages]);

  return null;
}

/**
 * Workshops as pins. A pin opens our own preview card docked at the bottom
 * of the map (not Google's InfoWindow), in the app's type and colours, with
 * booking and directions one tap away. Renders nothing without a Maps key
 * or without any workshop that has a pin.
 */
export function GarageDiscoveryMap({
  garages,
  lang,
  vehicleId = null,
  labels,
  className = "h-80 w-full overflow-hidden rounded-xl border border-hairline",
}: {
  garages: DiscoveryGarage[];
  lang: Locale;
  // Carried into the garage link (see lib/booking-vehicle.ts).
  vehicleId?: string | null;
  labels: DiscoveryMapLabels;
  /** Sizes and frames the map; the parent decides its height. */
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!apiKey || garages.length === 0) return null;

  const selected = garages.find((garage) => garage.id === selectedId);
  const routeUrl = selected ? directionsUrl(selected) : null;

  return (
    <div className={`relative ${className}`} role="region" aria-label={labels.map}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: garages[0].latitude, lng: garages[0].longitude }}
          defaultZoom={11}
          gestureHandling="cooperative"
          clickableIcons={false}
          disableDefaultUI
          zoomControl
          onClick={() => setSelectedId(null)}
        >
          <FitBounds garages={garages} />
          {garages.map((garage) => (
            <Marker
              key={garage.id}
              position={{ lat: garage.latitude, lng: garage.longitude }}
              title={garage.name}
              zIndex={garage.id === selectedId ? 10 : 1}
              onClick={() => setSelectedId(garage.id)}
            />
          ))}
        </Map>
      </APIProvider>

      {selected && (
        <div
          role="dialog"
          aria-label={selected.name}
          className={`${CLIENT_CARD} absolute inset-x-3 bottom-3 z-10 flex flex-col gap-4 p-4 sm:inset-x-auto sm:left-3 sm:w-80`}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-base font-bold tracking-[-0.02em] text-surface"
            >
              {monogram(selected.name)}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={withBookingVehicle(`/${lang}/garages/${selected.id}`, vehicleId)}
                className="block truncate font-display text-base font-bold tracking-[-0.02em] text-ink hover:underline"
              >
                {selected.name}
              </Link>
              {(selected.city || selected.distance) && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                  <MapPin aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{selected.city}</span>
                  {selected.distance && <span className="shrink-0 tabular-nums">({selected.distance})</span>}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={labels.close}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="flex gap-2">
            <Link
              href={withBookingVehicle(`/${lang}/garages/${selected.id}#book`, vehicleId)}
              className={`${CLIENT_PRIMARY_BUTTON} flex-1`}
            >
              {labels.book}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={labels.directions}
                title={labels.directions}
                className={`${CLIENT_TINTED_PILL} px-3`}
              >
                <Navigation aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

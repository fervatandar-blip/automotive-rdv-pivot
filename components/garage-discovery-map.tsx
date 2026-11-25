"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  APIProvider,
  Map,
  Marker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Locale } from "@/lib/i18n/config";
import { withBookingVehicle } from "@/lib/booking-vehicle";

type DiscoveryGarage = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

function FitBounds({ garages }: { garages: DiscoveryGarage[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || garages.length === 0) return;

    if (garages.length === 1) {
      map.setCenter({ lat: garages[0].latitude, lng: garages[0].longitude });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const garage of garages) {
      bounds.extend({ lat: garage.latitude, lng: garage.longitude });
    }
    map.fitBounds(bounds);
  }, [map, garages]);

  return null;
}

export function GarageDiscoveryMap({
  garages,
  lang,
  vehicleId = null,
  className = "h-80 w-full overflow-hidden rounded-xl border border-hairline",
}: {
  garages: DiscoveryGarage[];
  lang: Locale;
  // Carried into the garage link (see lib/booking-vehicle.ts).
  vehicleId?: string | null;
  /** Sizes and frames the map; the parent decides its height. */
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!apiKey || garages.length === 0) return null;

  const selected = garages.find((garage) => garage.id === selectedId);

  return (
    <div className={className}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: garages[0].latitude, lng: garages[0].longitude }}
          defaultZoom={11}
          gestureHandling="cooperative"
          disableDefaultUI
        >
          <FitBounds garages={garages} />
          {garages.map((garage) => (
            <Marker
              key={garage.id}
              position={{ lat: garage.latitude, lng: garage.longitude }}
              onClick={() => setSelectedId(garage.id)}
            />
          ))}
          {selected && (
            <InfoWindow
              position={{ lat: selected.latitude, lng: selected.longitude }}
              onCloseClick={() => setSelectedId(null)}
            >
              <Link
                href={withBookingVehicle(`/${lang}/garages/${selected.id}`, vehicleId)}
                className="text-sm font-medium underline"
              >
                {selected.name}
              </Link>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}

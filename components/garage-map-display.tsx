"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

export function GarageMapDisplay({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const position = { lat: latitude, lng: longitude };

  return (
    <div className="h-56 w-full overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={position}
          defaultZoom={15}
          gestureHandling="cooperative"
          disableDefaultUI
        >
          <Marker position={position} />
        </Map>
      </APIProvider>
    </div>
  );
}

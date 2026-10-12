"use client";

import dynamic from "next/dynamic";
import type { Coordinates, Place } from "@/lib/google-places";
import type { ItineraryItem } from "@/lib/gemini";

export type MappedItineraryItem = ItineraryItem & { id: string };
export type ItineraryMapProps = {
  items: MappedItineraryItem[];
  nearbyPlaces: Place[];
  currentPosition: Coordinates | null;
  activeKey: string | null;
  onSelect: (key: string) => void;
};

const ClientMap = dynamic<ItineraryMapProps>(() => import("./itinerary-map"), {
  ssr: false,
  loading: () => <div className="itineraryMapLoading" role="status">지도를 불러오고 있어요...</div>,
});

export default function ItineraryMapLoader(props: ItineraryMapProps) {
  return <ClientMap {...props} />;
}

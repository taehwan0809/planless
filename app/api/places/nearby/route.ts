import { NextRequest, NextResponse } from "next/server";
import {
  searchNearbyPlaces,
  type NearbySearchCategory,
} from "@/lib/google-places";

const categories: NearbySearchCategory[] = [
  "tourist_attraction",
  "indoor",
  "cafe",
  "restaurant",
];

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "주변 장소 검색 요청이 올바르지 않습니다." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const location = input.location;
    const category = input.category;
    const radius = input.radius;
    if (!location || typeof location !== "object") {
      return NextResponse.json({ error: "현재 위치가 필요합니다." }, { status: 400 });
    }
    const point = location as Record<string, unknown>;
    if (
      typeof point.latitude !== "number" || !Number.isFinite(point.latitude) ||
      point.latitude < -90 || point.latitude > 90 ||
      typeof point.longitude !== "number" || !Number.isFinite(point.longitude) ||
      point.longitude < -180 || point.longitude > 180
    ) {
      return NextResponse.json({ error: "현재 위치 좌표가 올바르지 않습니다." }, { status: 400 });
    }
    if (
      typeof radius !== "number" || !Number.isInteger(radius) || radius < 100 || radius > 5000 ||
      typeof category !== "string" || !categories.includes(category as NearbySearchCategory)
    ) {
      return NextResponse.json({ error: "검색 종류 또는 반경이 올바르지 않습니다." }, { status: 400 });
    }

    const places = await searchNearbyPlaces(
      { latitude: point.latitude, longitude: point.longitude },
      radius,
      category as NearbySearchCategory
    );
    return NextResponse.json({ places });
  } catch (error) {
    console.error("Nearby Places search failed:", error);
    return NextResponse.json({
      error: "현재 위치 주변 장소를 검색하지 못했습니다. 잠시 후 다시 시도해주세요.",
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { generateItinerary, type TripConditions } from "@/lib/gemini";
import type { Place } from "@/lib/google-places";
import { getAuthenticatedUser } from "@/lib/supabase";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  let stage: "setup" | "gemini" | "trip-save" | "itinerary-save" = "setup";
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const destination = input.destination;
    const situation = typeof input.situation === "string" ? input.situation.trim().slice(0, 1000) : "특별한 상황 없음";
    const remainingTime = Number(input.remainingTime);
    const budget = Number(input.budget);
    const people = Number(input.people);
    const activities = input.activities;
    const places = input.places;

    if (
      !isNonEmptyString(destination) ||
      destination.trim().length > 120 ||
      (input.situation !== undefined && typeof input.situation !== "string") ||
      !Number.isInteger(remainingTime) || remainingTime < 1 || remainingTime > 24 ||
      !Number.isInteger(budget) || budget < 0 ||
      !Number.isInteger(people) || people < 1 || people > 20 ||
      !Array.isArray(activities) || activities.length > 25 ||
      !activities.every((activity: unknown) => isNonEmptyString(activity) && activity.trim().length <= 800) ||
      !Array.isArray(places) || places.length === 0 || places.length > 30 ||
      !places.every(
        (place: unknown) =>
          !!place &&
          typeof place === "object" &&
          isNonEmptyString((place as Place).name) &&
          isNonEmptyString((place as Place).address)
      )
    ) {
      return NextResponse.json(
        { error: "여행 조건과 검색된 장소를 확인해주세요." },
        { status: 400 }
      );
    }

    const conditions: TripConditions = {
      destination,
      remainingTime,
      budget,
      people,
      situation,
      activities,
    };

    const { supabase, user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "일정을 저장하려면 로그인해주세요.", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    stage = "gemini";
    const itinerary = await generateItinerary(conditions, places as Place[]);
    stage = "trip-save";
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        destination,
        remaining_time: remainingTime,
        budget,
        people,
        situation,
        activities,
        title: itinerary.title,
        summary: itinerary.summary,
      })
      .select("id")
      .single();

    if (tripError || !trip) {
      console.error("Trip insert error:", tripError);
      return NextResponse.json(
        { error: "일정은 생성했지만 여행 기록을 저장하지 못했습니다." },
        { status: 500 }
      );
    }

    const itineraryRows = itinerary.items.map((item, index) => ({
      trip_id: trip.id,
      place_name: item.name,
      address: item.address,
      rating: item.rating ?? null,
      user_rating_count: item.userRatingCount ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      duration: item.duration,
      reason: item.reason,
      google_maps_uri: item.googleMapsUri ?? null,
      order_index: index,
    }));

    stage = "itinerary-save";
    const { error: itineraryError } = await supabase
      .from("itineraries")
      .insert(itineraryRows);

    if (itineraryError) {
      console.error("Itineraries insert error:", itineraryError);
      const { error: rollbackError } = await supabase
        .from("trips")
        .delete()
        .eq("id", trip.id);

      if (rollbackError) {
        console.error("Trip rollback error:", rollbackError);
      }

      return NextResponse.json(
        { error: "여행 기록 저장 중 오류가 발생했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ tripId: trip.id, ...itinerary });
  } catch (error) {
    console.error("Itinerary generation error:", error);
    const message = stage === "gemini"
      ? error instanceof Error
        ? error.message
        : "AI 일정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      : stage === "setup"
        ? "여행 기록 서비스 설정을 확인할 수 없습니다. 잠시 후 다시 시도해주세요."
        : stage === "trip-save"
          ? "일정은 생성했지만 여행 기록을 저장하지 못했습니다."
          : "여행 일정 저장 중 오류가 발생했습니다. 다시 시도해주세요.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

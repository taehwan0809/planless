import { NextRequest, NextResponse } from "next/server";
import { generateItinerary, type TripConditions } from "@/lib/gemini";
import type { Place } from "@/lib/google-places";
import { createSupabaseClient } from "@/lib/supabase";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const { destination, situation } = input;
    const remainingTime = Number(input.remainingTime);
    const budget = Number(input.budget);
    const people = Number(input.people);
    const activities = input.activities;
    const places = input.places;

    if (
      !isNonEmptyString(destination) ||
      !isNonEmptyString(situation) ||
      !Number.isInteger(remainingTime) || remainingTime < 1 || remainingTime > 24 ||
      !Number.isInteger(budget) || budget < 0 ||
      !Number.isInteger(people) || people < 1 || people > 20 ||
      !Array.isArray(activities) || activities.length === 0 ||
      !activities.every(isNonEmptyString) ||
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

    const supabase = createSupabaseClient();
    const itinerary = await generateItinerary(conditions, places as Place[]);
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
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
      duration: item.duration,
      reason: item.reason,
      google_maps_uri: item.googleMapsUri ?? null,
      order_index: index,
    }));

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
    const message =
      error instanceof Error &&
      (error.message.includes("Supabase") ||
        error.message.includes("Google Places") ||
        error.message.includes("일정") ||
        error.message.includes("Gemini"))
        ? error.message
        : "AI 일정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

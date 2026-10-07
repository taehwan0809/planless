import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/google-places";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "검색어가 필요합니다." },
        { status: 400 }
      );
    }

    const places = await searchPlaces(query);

    return NextResponse.json({ places });
  } catch (error) {
    console.error("Places API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "장소 검색 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

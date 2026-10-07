import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TripRecord = {
  id: string;
  destination: string;
  remaining_time: number;
  budget: number;
  people: number;
  situation: string;
  activities: string[];
  title: string;
  summary: string;
  created_at: string;
};

type ItineraryRecord = {
  id: string;
  place_name: string;
  address: string;
  rating: number | null;
  user_rating_count: number | null;
  duration: number;
  reason: string;
  google_maps_uri: string | null;
  order_index: number;
};

type PageProps = { params: Promise<{ id: string }> };

export default async function ItineraryDetailPage({ params }: PageProps) {
  const { id } = await params;
  let trip: TripRecord | null = null;
  let items: ItineraryRecord[] = [];
  let errorMessage = "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    errorMessage = "일정을 찾을 수 없습니다.";
  } else {
    try {
      const supabase = createSupabaseClient();
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("id, destination, remaining_time, budget, people, situation, activities, title, summary, created_at")
        .eq("id", id)
        .maybeSingle();

      if (tripError) {
        console.error("Trip detail query error:", tripError);
        errorMessage = "일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
      } else if (!tripData) {
        errorMessage = "일정을 찾을 수 없습니다.";
      } else {
        trip = tripData as TripRecord;
        const { data: itemData, error: itemError } = await supabase
          .from("itineraries")
          .select("id, place_name, address, rating, user_rating_count, duration, reason, google_maps_uri, order_index")
          .eq("trip_id", id)
          .order("order_index", { ascending: true });

        if (itemError) {
          console.error("Itinerary items query error:", itemError);
          errorMessage = "일정 장소 정보를 불러오지 못했습니다.";
          trip = null;
        } else {
          items = (itemData ?? []) as ItineraryRecord[];
        }
      }
    } catch (error) {
      console.error("Supabase configuration error:", error);
      errorMessage =
        error instanceof Error ? error.message : "Supabase 연결 설정을 확인해주세요.";
    }
  }

  return (
    <main className="createPage">
      <div className="createContainer">
        <nav className="pageNav" aria-label="주 메뉴">
          <Link className="backLink" href="/">PLANLESS</Link>
          <Link href="/create">새 일정</Link>
          <Link href="/history">기록</Link>
        </nav>

        {errorMessage ? (
          <section className="detailMessage" role="status">
            <h1>{errorMessage}</h1>
            <Link href="/history">여행 기록으로 돌아가기</Link>
          </section>
        ) : trip ? (
          <>
            <header className="pageHeader detailHeader">
              <p className="step">
                {new Date(trip.created_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <h1>{trip.title}</h1>
              <p>{trip.summary}</p>
              <p className="historyDestination">{trip.destination}</p>
            </header>

            <section className="tripConditions">
              <h2>여행 조건</h2>
              <dl>
                <div><dt>남은 시간</dt><dd>{trip.remaining_time}시간</dd></div>
                <div><dt>예산</dt><dd>{trip.budget.toLocaleString()}원</dd></div>
                <div><dt>인원</dt><dd>{trip.people}명</dd></div>
                <div><dt>현재 상황</dt><dd>{trip.situation}</dd></div>
                <div><dt>원하는 활동</dt><dd>{trip.activities.join(", ")}</dd></div>
              </dl>
            </section>

            <section className="resultsSection">
              <h2>일정</h2>
              {items.length === 0 ? (
                <p className="emptyResults">저장된 일정 장소가 없습니다.</p>
              ) : (
                <ol className="placeList">
                  {items.map((item, index) => (
                    <li className="placeItem itineraryItem" key={item.id}>
                      <p className="step">{String(index + 1).padStart(2, "0")}</p>
                      <h3>{item.place_name}</h3>
                      <p>{item.address}</p>
                      <p className="placeMeta">
                        {item.rating !== null ? `평점 ${item.rating}` : "평점 정보 없음"}
                        {item.user_rating_count !== null &&
                          ` · 리뷰 ${item.user_rating_count.toLocaleString()}개`}
                        {` · 예상 체류 ${item.duration}분`}
                      </p>
                      <p className="itineraryReason">{item.reason}</p>
                      {item.google_maps_uri && (
                        <a href={item.google_maps_uri} target="_blank" rel="noreferrer">
                          Google Maps에서 보기 ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TripRecord = {
  id: string;
  destination: string;
  title: string;
  summary: string;
  created_at: string;
};

export default async function HistoryPage() {
  let trips: TripRecord[] = [];
  let errorMessage = "";

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("trips")
      .select("id, destination, title, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Trip history query error:", error);
      errorMessage = "여행 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    } else {
      trips = (data ?? []) as TripRecord[];
    }
  } catch (error) {
    console.error("Supabase configuration error:", error);
    errorMessage =
      error instanceof Error ? error.message : "Supabase 연결 설정을 확인해주세요.";
  }

  return (
    <main className="createPage">
      <div className="createContainer">
        <nav className="pageNav" aria-label="주 메뉴">
          <Link className="backLink" href="/">PLANLESS</Link>
          <Link href="/create">새 일정</Link>
          <Link href="/history" aria-current="page">기록</Link>
        </nav>
        <header className="pageHeader">
          <p className="step">YOUR TRIPS</p>
          <h1>여행 기록</h1>
          <p>다시 만든 일정을 모아봤어요.</p>
        </header>

        {errorMessage ? (
          <p className="searchError" role="alert">{errorMessage}</p>
        ) : trips.length === 0 ? (
          <div className="emptyResults">
            <p>아직 생성한 여행 일정이 없습니다.</p>
            <Link href="/create">첫 일정 만들기 →</Link>
          </div>
        ) : (
          <ul className="placeList historyList">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link className="historyCard" href={`/itinerary/${trip.id}`}>
                  <p className="step">
                    {new Date(trip.created_at).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h2>{trip.title}</h2>
                  <p className="historyDestination">{trip.destination}</p>
                  <p>{trip.summary}</p>
                  <span>일정 자세히 보기 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

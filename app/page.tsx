import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="homeShell">
        <nav className="homeNav" aria-label="주 메뉴">
          <Link className="brand" href="/">PLANLESS<span>TRAVEL, ADAPTED</span></Link>
          <div><Link href="/history">저장된 여행</Link><Link href="/create">새 일정</Link></div>
        </nav>
        <section className="hero">
          <div className="heroCopy">
            <p className="eyebrow"><span className="eyebrowDot" /> 여행의 변수를 위한 플랜 B</p>
            <h1>여행이 계획대로<br />흘러가지 않을 때.</h1>
            <p className="description">
              비, 휴무, 부족한 시간에도 괜찮아요.<br />
              현재 위치와 실제 주변 장소를 바탕으로 지금에 맞는 일정을 다시 구성합니다.
            </p>
            <div className="heroActions">
              <Link href="/create" className="startButton">여행 일정 만들기 <span aria-hidden="true">→</span></Link>
              <Link href="/history" className="secondaryButton">저장된 여행 보기</Link>
            </div>
            <p className="heroFootnote">기존 일정은 보존하고, 필요한 부분만 새롭게 제안해요.</p>
          </div>
          <div className="heroPreview" aria-label="장소와 일정을 지도에서 확인하는 서비스 미리보기">
            <div className="previewTop"><span>오늘의 일정</span><span className="previewBadge">PLAN B 준비 완료</span></div>
            <div className="previewMap" aria-hidden="true">
              <span className="mapRoad roadOne" /><span className="mapRoad roadTwo" />
              <span className="mapWater" /><span className="previewPin pinOne">1</span>
              <span className="previewPin pinTwo">2</span><span className="previewPin pinThree">3</span>
              <span className="mapCaption">현재 위치 주변 장소</span>
            </div>
            <div className="previewStops">
              <div><span className="stopNumber">01</span><span><strong>일정은 유연하게</strong><small>변경이 필요한 장소만 다시 찾아요</small></span><span className="stopState">유지</span></div>
              <div className="previewChanged"><span className="stopNumber">02</span><span><strong>가까운 실내 장소</strong><small>날씨에 맞춰 대체 후보를 제안해요</small></span><span className="stopState changed">대안</span></div>
            </div>
          </div>
        </section>
        <footer className="homeFooter"><span>PLANLESS</span><span>예상치 못한 순간에도, 여행은 계속됩니다.</span></footer>
      </div>
    </main>
  );
}

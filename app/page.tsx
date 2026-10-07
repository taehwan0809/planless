export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <p className="brand">PLANLESS</p>

        <h1>
          계획대로 되지 않는 여행,
          <br />
          다시 계획하세요.
        </h1>

        <p className="description">
          갑작스러운 날씨 변화, 일정 취소, 부족한 시간까지.
          <br />
          PLANLESS가 현재 상황에 맞는 새로운 여행 일정을 만들어드립니다.
        </p>

        <a href="/create" className="startButton">
          일정 다시 만들기
        </a>
      </section>
    </main>
  );
}

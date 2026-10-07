"use client";

import { FormEvent, useState } from "react";

const situations = [
  "갑자기 비가 와요",
  "원래 일정이 취소됐어요",
  "생각보다 시간이 부족해요",
  "일정에 여유가 생겼어요",
  "새로운 장소를 찾고 싶어요",
];

const activities = [
  "관광",
  "카페",
  "맛집",
  "쇼핑",
  "체험",
  "산책",
];

export default function CreatePage() {
  const [destination, setDestination] = useState("");
  const [remainingTime, setRemainingTime] = useState("3");
  const [budget, setBudget] = useState("");
  const [people, setPeople] = useState("2");
  const [situation, setSituation] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const toggleActivity = (activity: string) => {
    setSelectedActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity]
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log({
      destination,
      remainingTime,
      budget,
      people,
      situation,
      activities: selectedActivities,
    });

    alert("여행 조건이 입력되었습니다.");
  };

  return (
    <main className="createPage">
      <div className="createContainer">
        <a href="/" className="backLink">
          ← PLANLESS
        </a>

        <div className="pageHeader">
          <p className="step">STEP 01</p>
          <h1>현재 여행 상황을 알려주세요.</h1>
          <p>
            지금 상황에 맞춰 새로운 여행 일정을 만들어드릴게요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="conditionForm">
          <div className="formGroup">
            <label htmlFor="destination">여행 지역</label>
            <input
              id="destination"
              type="text"
              placeholder="예: 제주 애월"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </div>

          <div className="formRow">
            <div className="formGroup">
              <label htmlFor="remainingTime">남은 시간</label>
              <div className="inputWithUnit">
                <input
                  id="remainingTime"
                  type="number"
                  min="1"
                  max="24"
                  value={remainingTime}
                  onChange={(event) => setRemainingTime(event.target.value)}
                  required
                />
                <span>시간</span>
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="budget">예산</label>
              <div className="inputWithUnit">
                <input
                  id="budget"
                  type="number"
                  min="0"
                  placeholder="50000"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  required
                />
                <span>원</span>
              </div>
            </div>
          </div>

          <div className="formGroup">
            <label htmlFor="people">인원</label>
            <div className="inputWithUnit">
              <input
                id="people"
                type="number"
                min="1"
                max="20"
                value={people}
                onChange={(event) => setPeople(event.target.value)}
                required
              />
              <span>명</span>
            </div>
          </div>

          <div className="formGroup">
            <label>현재 상황</label>

            <div className="optionGrid">
              {situations.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`optionButton ${
                    situation === item ? "selected" : ""
                  }`}
                  onClick={() => setSituation(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="formGroup">
            <label>원하는 활동</label>

            <div className="optionGrid">
              {activities.map((activity) => (
                <button
                  type="button"
                  key={activity}
                  className={`optionButton ${
                    selectedActivities.includes(activity) ? "selected" : ""
                  }`}
                  onClick={() => toggleActivity(activity)}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="generateButton"
            disabled={!situation || selectedActivities.length === 0}
          >
            일정 생성하기 →
          </button>
        </form>
      </div>
    </main>
  );
}

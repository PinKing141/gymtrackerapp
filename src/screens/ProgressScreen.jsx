import { Spark } from "../components/WorkoutComponents.jsx";
import { KEY_LIFTS } from "../data.js";
import { C, L } from "../storage.js";
import { getExercisesForWorkout, getWorkoutForSession, getWorkoutPresets } from "../workouts.js";
import { Screen, ScreenHeader, SurfaceCard } from "../components/ui.jsx";

export function ProgressScreen({ app }) {
  const workoutPresets = getWorkoutPresets(app);
  const weeklySessionTrend = (() => {
    const buckets = new Map();
    app.sessions.forEach((session) => {
      const date = new Date(`${session.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, count]) => count);
  })();

  const liftData = (liftName) => {
    const points = [];
    app.sessions.forEach((session) => {
      const workout = getWorkoutForSession(session);
      getExercisesForWorkout(workout).forEach((exercise, index) => {
        if (exercise.name === liftName) {
          const maxKg = Math.max(0, ...(session.sets[`${index}-${exercise.name}`] || []).map((setData) => parseFloat(setData.kg) || 0));
          if (maxKg > 0) {
            points.push({ date: session.date, kg: maxKg });
          }
        }
      });
    });
    return points;
  };

  return (
    <Screen>
      <ScreenHeader title="Progress" />

      {weeklySessionTrend.length > 1 && (
        <SurfaceCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#fff" }}>Workout Frequency</p>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#2D7DD2" }}>{weeklySessionTrend[weeklySessionTrend.length - 1]} this week</p>
          </div>
          <div style={{ marginTop: 8 }}>
            <Spark data={weeklySessionTrend} color="#2D7DD2" height={40} />
          </div>
          <p style={{ fontSize: 9, color: "#555", margin: "6px 0 0" }}>Last 12 weeks (sessions per week)</p>
        </SurfaceCard>
      )}

      {KEY_LIFTS.map((lift) => {
        const data = liftData(lift);
        if (!data.length) {
          return <SurfaceCard key={lift}><p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#fff" }}>{lift}</p><p style={{ fontSize: 11, color: "#444", margin: "3px 0 0" }}>No data yet</p></SurfaceCard>;
        }

        return (
          <SurfaceCard key={lift}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#fff" }}>{lift}</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#45B649" }}>{data[data.length - 1].kg}kg</p>
            </div>
            <div style={{ marginTop: 8 }}>
              <Spark data={data.slice(-12).map((entry) => entry.kg)} color="#45B649" height={36} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "#444" }}>{data.length} sessions</span>
              {data.length > 1 && <span style={{ fontSize: 9, color: data[data.length - 1].kg >= data[0].kg ? "#45B649" : "#E84545" }}>{data[data.length - 1].kg >= data[0].kg ? "↑" : "↓"} {Math.abs(data[data.length - 1].kg - data[0].kg)}kg</span>}
            </div>
          </SurfaceCard>
        );
      })}

      <p style={L}>Sessions per Workout</p>
      {workoutPresets.map((workout) => {
        const count = app.sessions.filter((session) => session.workoutId === workout.id).length;
        return (
          <div key={workout.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: workout.color, fontWeight: 600, width: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workout.shortTitle}</span>
            <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, count * 8)}%`, height: "100%", background: workout.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, color: "#555", minWidth: 16, textAlign: "right" }}>{count}</span>
          </div>
        );
      })}

      {app.bodyStats.length > 0 && (
        <>
          <p style={L}>Bodyweight</p>
          <SurfaceCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Weight Trend</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#2D7DD2" }}>{app.bodyStats[app.bodyStats.length - 1].weight} lbs</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Spark data={app.bodyStats.slice(-12).map((entry) => entry.weight)} color="#2D7DD2" height={36} />
            </div>
          </SurfaceCard>
        </>
      )}

      {app.sessions.length >= 2 && app.sessions.some((session) => typeof session.painFlags?.shoulder === "number") && (
        <>
          <p style={L}>Injury Trends</p>
          {["shoulder", "ankle", "hip"].map((part) => {
            const data = app.sessions.filter((session) => typeof session.painFlags?.[part] === "number").map((session) => session.painFlags[part]);
            if (data.length < 2) {
              return null;
            }
            const latest = data[data.length - 1];
            const color = latest <= 2 ? "#45B649" : latest <= 3 ? "#F5A623" : "#E84545";
            return (
              <SurfaceCard key={part}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, textTransform: "capitalize" }}>L. {part}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color }}>{latest}/5</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <Spark data={data.slice(-12)} color={color} height={28} />
                </div>
                <p style={{ fontSize: 9, color: "#444", marginTop: 3, marginBottom: 0 }}>{data.length} check-ins · {latest <= data[0] ? "Improving ↓" : "Watch this ↑"}</p>
              </SurfaceCard>
            );
          })}
        </>
      )}
    </Screen>
  );
}

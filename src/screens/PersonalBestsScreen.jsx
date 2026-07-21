import { C, fd } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { Screen, ScreenHeader, SurfaceCard } from "../components/ui.jsx";

export function PersonalBestsScreen({ app }) {
  const records = Object.entries(app.personalBests).sort(([, left], [, right]) => right.kg - left.kg);

  return (
    <Screen>
      <ScreenHeader title="Personal bests" subtitle={`${records.length} records`} />
      {!records.length ? (
        <div style={{ textAlign: "center", paddingTop: 50 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <Icon name="trophy" size={38} color="#F5A623" />
          </div>
          <p style={{ fontSize: 14, color: "#555" }}>Log sessions to track PBs.</p>
        </div>
      ) : (
        records.map(([name, personalBest], index) => (
          <SurfaceCard key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: index === 0 ? "rgba(245,166,35,0.05)" : C.background, borderColor: index === 0 ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: index === 0 ? "#F5A623" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                {index === 0 && <Icon name="crown" size={13} color="#F5A623" />}
                {name}
              </p>
              <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>{fd(personalBest.date)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 17, fontWeight: 700, margin: 0, color: index === 0 ? "#F5A623" : "#fff" }}>{personalBest.kg}kg</p>
              {personalBest.reps && <p style={{ fontSize: 10, color: "#555", margin: 0 }}>×{personalBest.reps}</p>}
            </div>
          </SurfaceCard>
        ))
      )}
    </Screen>
  );
}

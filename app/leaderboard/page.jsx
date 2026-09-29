"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import styles from "./leaderboard.module.css";

function getRankInfo(points) {
  if (points >= 900) return { rank: "Grand Master", icon: "♛", color: "#f5c542" };
  if (points >= 700) return { rank: "Master",       icon: "♜", color: "#a855f7" };
  if (points >= 500) return { rank: "Expert",       icon: "♞", color: "#38bdf8" };
  if (points >= 300) return { rank: "Knight",       icon: "♝", color: "#4ade80" };
  return               { rank: "Pawn",              icon: "♟", color: "#8a8a9a" };
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [players, setPlayers] = useState([]);
  const [myRank, setMyRank]   = useState(null);
  const [myData, setMyData]   = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | weekly (future)

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          orderBy("points", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        const list = [];
        let rank = 1;
        snap.forEach(d => {
          list.push({ id: d.id, rank, ...d.data() });
          rank++;
        });
        setPlayers(list);

        // Find own position
        const me = list.find(p => p.id === user.uid);
        if (me) {
          setMyRank(me.rank);
          setMyData(me);
        } else {
          // User not in top-50, fetch individually
          const meDoc = await getDoc(doc(db, "users", user.uid));
          if (meDoc.exists()) setMyData(meDoc.data());
        }
      } catch (e) {
        console.error("Leaderboard load error:", e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading || !user) {
    return <div className={styles.loading}>♔ Loading Leaderboard... ♛</div>;
  }

  const myRankInfo = myData ? getRankInfo(myData.points ?? 500) : null;

  return (
    <main className={styles.leaderboardMain}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => router.push("/lobby")}>
          ← Lobby
        </button>
        <h1 className={styles.pageTitle}>🏆 Leaderboard</h1>
        <div className={styles.headerRight}>
          <button onClick={toggleTheme} className={styles.iconBtn}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className={styles.profileBtn} onClick={() => router.push("/profile")}>
            👤 Profile
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* My rank pill */}
        {myData && (
          <div className={styles.myRankCard} style={{ borderColor: (myRankInfo?.color ?? "#f5c542") + "55" }}>
            <div className={styles.myRankAvatar} style={{ borderColor: myRankInfo?.color }}>
              {(myData.name || user.email || "?")[0].toUpperCase()}
            </div>
            <div className={styles.myRankInfo}>
              <div className={styles.myRankName}>{myData.name || user.email}</div>
              <div className={styles.myRankSub} style={{ color: myRankInfo?.color }}>
                {myRankInfo?.icon} {myRankInfo?.rank}
              </div>
            </div>
            <div className={styles.myRankRight}>
              <div className={styles.myRankPts} style={{ color: myRankInfo?.color }}>
                {myData.points ?? 500}
              </div>
              <div className={styles.myRankLabel}>POINTS</div>
            </div>
            {myRank && (
              <div className={styles.myRankPos}>
                <span className={styles.myRankPosNum}>#{myRank}</span>
                <span className={styles.myRankPosLabel}>Your Rank</span>
              </div>
            )}
          </div>
        )}

        {/* Top-3 podium */}
        {!isLoading && players.length >= 3 && (
          <div className={styles.podium}>
            {/* 2nd */}
            <div className={`${styles.podiumSlot} ${styles.second}`}>
              <div className={styles.podiumMedal}>🥈</div>
              <div className={styles.podiumAvatar} style={{ borderColor: "#c0c0c0" }}>
                {(players[1].name || "?")[0].toUpperCase()}
              </div>
              <div className={styles.podiumName}>{players[1].name?.split(" ")[0] || "Player"}</div>
              <div className={styles.podiumPts} style={{ color: "#c0c0c0" }}>{players[1].points ?? 500}</div>
              <div className={styles.podiumBlock} style={{ height: 80, background: "rgba(192,192,192,0.15)", borderColor: "rgba(192,192,192,0.3)" }} />
            </div>
            {/* 1st */}
            <div className={`${styles.podiumSlot} ${styles.first}`}>
              <div className={styles.podiumMedal}>🥇</div>
              <div className={styles.podiumCrown}>♛</div>
              <div className={styles.podiumAvatar} style={{ borderColor: "#f5c542" }}>
                {(players[0].name || "?")[0].toUpperCase()}
              </div>
              <div className={styles.podiumName}>{players[0].name?.split(" ")[0] || "Player"}</div>
              <div className={styles.podiumPts} style={{ color: "#f5c542" }}>{players[0].points ?? 500}</div>
              <div className={styles.podiumBlock} style={{ height: 110, background: "rgba(245,197,66,0.12)", borderColor: "rgba(245,197,66,0.35)" }} />
            </div>
            {/* 3rd */}
            <div className={`${styles.podiumSlot} ${styles.third}`}>
              <div className={styles.podiumMedal}>🥉</div>
              <div className={styles.podiumAvatar} style={{ borderColor: "#cd7f32" }}>
                {(players[2].name || "?")[0].toUpperCase()}
              </div>
              <div className={styles.podiumName}>{players[2].name?.split(" ")[0] || "Player"}</div>
              <div className={styles.podiumPts} style={{ color: "#cd7f32" }}>{players[2].points ?? 500}</div>
              <div className={styles.podiumBlock} style={{ height: 60, background: "rgba(205,127,50,0.12)", borderColor: "rgba(205,127,50,0.3)" }} />
            </div>
          </div>
        )}

        {/* Full table */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>Rank</span>
            <span>Player</span>
            <span>W / L / D</span>
            <span>Win%</span>
            <span>Points</span>
          </div>

          {isLoading ? (
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonBar} style={{ width: "100%", height: 56, opacity: 0.4 - i * 0.04 }} />
              </div>
            ))
          ) : players.length === 0 ? (
            <div className={styles.emptyState}>No players yet. Be the first to play!</div>
          ) : (
            players.map((p, i) => {
              const ri       = getRankInfo(p.points ?? 500);
              const isMe     = p.id === user.uid;
              const total    = (p.wins ?? 0) + (p.losses ?? 0) + (p.draws ?? 0);
              const winRate  = total > 0 ? Math.round(((p.wins ?? 0) / total) * 100) : 0;
              return (
                <div
                  key={p.id}
                  className={`${styles.tableRow} ${isMe ? styles.tableRowMe : ""}`}
                  style={isMe ? { borderColor: ri.color + "66" } : {}}
                >
                  <div className={styles.rankCell}>
                    {i < 3 ? (
                      <span className={styles.medal}>{MEDAL[i]}</span>
                    ) : (
                      <span className={styles.rankNum}>#{p.rank}</span>
                    )}
                  </div>
                  <div className={styles.playerCell}>
                    <div className={styles.playerAvatar} style={{ borderColor: ri.color, color: ri.color }}>
                      {(p.name || "?")[0].toUpperCase()}
                    </div>
                    <div className={styles.playerInfo}>
                      <div className={styles.playerName}>
                        {p.name || "Unknown"}
                        {isMe && <span className={styles.youBadge}>YOU</span>}
                      </div>
                      <div className={styles.playerRank} style={{ color: ri.color }}>
                        {ri.icon} {ri.rank}
                      </div>
                    </div>
                  </div>
                  <div className={styles.wldCell}>
                    <span style={{ color: "#4ade80" }}>{p.wins ?? 0}</span>
                    {" / "}
                    <span style={{ color: "#f87171" }}>{p.losses ?? 0}</span>
                    {" / "}
                    <span style={{ color: "#fbbf24" }}>{p.draws ?? 0}</span>
                  </div>
                  <div className={styles.winRateCell}>
                    <div className={styles.winRateBar}>
                      <div
                        className={styles.winRateFill}
                        style={{ width: `${winRate}%`, background: `linear-gradient(90deg, #4ade8099, #4ade80)` }}
                      />
                    </div>
                    <span className={styles.winRateNum}>{winRate}%</span>
                  </div>
                  <div className={styles.pointsCell} style={{ color: ri.color }}>
                    <span className={styles.pointsNum}>{p.points ?? 500}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, signOut } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/Toast";
import Footer from "@/components/Footer";
import styles from "./profile.module.css";

function generatePlayerId(uid) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const hash = uid.split("").reduce((a, b) => { a = (a << 5) - a + b.charCodeAt(0); return a & a; }, 0);
  for (let i = 0; i < 6; i++) result += chars[Math.abs(hash + i) % chars.length];
  return result;
}

function getRankInfo(points) {
  if (points >= 900) return { rank: "Grand Master", icon: "♛", color: "#f5c542", tier: 5 };
  if (points >= 700) return { rank: "Master",       icon: "♜", color: "#a855f7", tier: 4 };
  if (points >= 500) return { rank: "Expert",       icon: "♞", color: "#38bdf8", tier: 3 };
  if (points >= 300) return { rank: "Knight",       icon: "♝", color: "#4ade80", tier: 2 };
  return               { rank: "Pawn",              icon: "♟", color: "#8a8a9a", tier: 1 };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [userData, setUserData] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        // Initialize user stats
        const playerId = generatePlayerId(user.uid);
        const initialData = {
          name: user.displayName || user.email,
          email: user.email,
          playerId,
          points: 500,
          wins: 0,
          losses: 0,
          draws: 0,
          isOnline: true,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", user.uid), initialData, { merge: true });
        setUserData(initialData);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
    }
  }, [user]);

  const loadRecentGames = useCallback(async () => {
    if (!user) return;
    setIsLoadingGames(true);
    try {
      // Games as player1
      const q1 = query(
        collection(db, "gameRooms"),
        where("player1.uid", "==", user.uid),
        where("status", "==", "finished"),
        orderBy("endedAt", "desc"),
        limit(10)
      );
      // Games as player2
      const q2 = query(
        collection(db, "gameRooms"),
        where("player2.uid", "==", user.uid),
        where("status", "==", "finished"),
        orderBy("endedAt", "desc"),
        limit(10)
      );

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const games = [];
      snap1.forEach(d => games.push({ id: d.id, ...d.data() }));
      snap2.forEach(d => games.push({ id: d.id, ...d.data() }));

      // Sort by endedAt descending, take latest 10
      games.sort((a, b) => {
        const ta = a.endedAt?.toMillis?.() || 0;
        const tb = b.endedAt?.toMillis?.() || 0;
        return tb - ta;
      });

      setRecentGames(games.slice(0, 10));
    } catch (e) {
      console.error("Error loading games:", e);
    } finally {
      setIsLoadingGames(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
    loadRecentGames();
  }, [loadUserData, loadRecentGames]);

  async function handleSaveName() {
    const name = newDisplayName.trim();
    if (!name || name.length < 2) { toast.warning("Name must be at least 2 characters"); return; }
    if (name.length > 24)          { toast.warning("Name must be 24 characters or less"); return; }
    setIsSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      await updateDoc(doc(db, "users", user.uid), { name });
      setUserData(prev => ({ ...prev, name }));
      setNewDisplayName("");
      toast.success("Display name updated!");
    } catch (e) {
      toast.error("Failed to update name. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleLogout() {
    try {
      await updateDoc(doc(db, "users", user.uid), { isOnline: false });
      await signOut(auth);
      router.push("/auth");
    } catch {
      toast.error("Logout failed");
    }
  }

  function getGameResult(game) {
    const isPlayer1 = game.player1?.uid === user.uid;
    const myColor  = isPlayer1 ? "white" : "black";
    const opponent = isPlayer1 ? game.player2 : game.player1;
    if (game.result === "draw") return { label: "Draw", color: "#fbbf24", icon: "🤝" };
    if (game.winner === myColor) return { label: "Win", color: "#4ade80", icon: "🏆" };
    return { label: "Loss", color: "#f87171", icon: "💀" };
  }

  function formatDate(ts) {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  if (loading || !user) {
    return <div className={styles.loading}>♔ Loading Profile... ♛</div>;
  }

  const pts     = userData?.points ?? 500;
  const wins    = userData?.wins   ?? 0;
  const losses  = userData?.losses ?? 0;
  const draws   = userData?.draws  ?? 0;
  const total   = wins + losses + draws;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const rankInfo = getRankInfo(pts);

  // Points bar: 0–1000 range for display (clamp)
  const barPct = Math.min(100, Math.max(0, (pts / 1000) * 100));

  return (
    <main className={styles.profileMain}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => router.push("/lobby")}>
          ← Lobby
        </button>
        <h1 className={styles.pageTitle}>♟ Profile</h1>
        <div className={styles.headerActions}>
          <button onClick={toggleTheme} className={styles.iconBtn}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className={styles.leaderboardBtn} onClick={() => router.push("/leaderboard")}>
            🏆 Leaderboard
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.profileContent}>
        {/* ── Hero card ── */}
        <div className={styles.heroCard}>
          <div className={styles.avatarRing} style={{ borderColor: rankInfo.color }}>
            <div className={styles.avatarInner}>
              {(user.displayName || user.email || "?")[0].toUpperCase()}
            </div>
          </div>

          <div className={styles.heroInfo}>
            <h2 className={styles.heroName}>{userData?.name || user.displayName || user.email}</h2>
            <div className={styles.heroId}>#{userData?.playerId || generatePlayerId(user.uid)}</div>
            <div className={styles.rankBadge} style={{ color: rankInfo.color, borderColor: rankInfo.color + "55" }}>
              <span>{rankInfo.icon}</span>
              <span>{rankInfo.rank}</span>
            </div>
          </div>

          <div className={styles.pointsBlock}>
            <div className={styles.pointsValue} style={{ color: rankInfo.color }}>{pts}</div>
            <div className={styles.pointsLabel}>POINTS</div>
            <div className={styles.pointsBar}>
              <div
                className={styles.pointsFill}
                style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${rankInfo.color}99, ${rankInfo.color})` }}
              />
            </div>
            <div className={styles.pointsScale}><span>0</span><span>1000</span></div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className={styles.statsRow}>
          {[
            { label: "Wins",    value: wins,    icon: "🏆", color: "#4ade80" },
            { label: "Losses",  value: losses,  icon: "💀", color: "#f87171" },
            { label: "Draws",   value: draws,   icon: "🤝", color: "#fbbf24" },
            { label: "Win Rate",value: `${winRate}%`, icon: "📊", color: "#38bdf8" },
            { label: "Games",   value: total,   icon: "🎮", color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          {["overview", "games", "settings"].map(t => (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {t === "overview" ? "📈 Overview" : t === "games" ? "🎮 Last Games" : "⚙️ Settings"}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ── */}
        {activeTab === "overview" && (
          <div className={styles.tabContent}>
            <div className={styles.overviewGrid}>
              {/* Rank progression */}
              <div className={styles.infoCard}>
                <h3 className={styles.cardTitle}>🏅 Rank Progression</h3>
                {[
                  { label: "Pawn",        pts: 0,   icon: "♟", color: "#8a8a9a" },
                  { label: "Knight",      pts: 300,  icon: "♝", color: "#4ade80" },
                  { label: "Expert",      pts: 500,  icon: "♞", color: "#38bdf8" },
                  { label: "Master",      pts: 700,  icon: "♜", color: "#a855f7" },
                  { label: "Grand Master",pts: 900,  icon: "♛", color: "#f5c542" },
                ].map(r => (
                  <div key={r.label} className={`${styles.rankRow} ${pts >= r.pts ? styles.rankUnlocked : ""}`}>
                    <span style={{ color: pts >= r.pts ? r.color : "#4a4a5a", fontSize: "1.3rem" }}>{r.icon}</span>
                    <span className={styles.rankRowLabel} style={{ color: pts >= r.pts ? r.color : "#4a4a5a" }}>{r.label}</span>
                    <span className={styles.rankRowPts}>{r.pts}+ pts</span>
                    {pts >= r.pts && <span className={styles.rankCheck}>✓</span>}
                  </div>
                ))}
              </div>

              {/* Points info */}
              <div className={styles.infoCard}>
                <h3 className={styles.cardTitle}>💰 Points System</h3>
                <div className={styles.pointsInfoList}>
                  {[
                    { event: "Win by Checkmate", pts: "+25", color: "#4ade80" },
                    { event: "Win (Opponent resigns)", pts: "+20", color: "#4ade80" },
                    { event: "Draw",                  pts: "+5",  color: "#fbbf24" },
                    { event: "Loss",                  pts: "−15", color: "#f87171" },
                    { event: "Starting points",       pts: "500", color: "#38bdf8" },
                    { event: "Minimum points",        pts: "0",   color: "#8a8a9a" },
                  ].map(p => (
                    <div key={p.event} className={styles.pointsInfoRow}>
                      <span className={styles.pointsEvent}>{p.event}</span>
                      <span className={styles.pointsDelta} style={{ color: p.color }}>{p.pts}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Last Games ── */}
        {activeTab === "games" && (
          <div className={styles.tabContent}>
            {isLoadingGames ? (
              <div className={styles.emptyState}>Loading games...</div>
            ) : recentGames.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: "3rem" }}>♟</div>
                <p>No completed games yet. Go play!</p>
                <button className={styles.playBtn} onClick={() => router.push("/lobby")}>Go to Lobby</button>
              </div>
            ) : (
              <div className={styles.gamesList}>
                {recentGames.map(game => {
                  const result  = getGameResult(game);
                  const isP1    = game.player1?.uid === user.uid;
                  const opponent = isP1 ? game.player2 : game.player1;
                  const myColor  = isP1 ? "White" : "Black";
                  return (
                    <div key={game.id} className={styles.gameRow} style={{ borderLeftColor: result.color }}>
                      <div className={styles.gameResult}>
                        <span className={styles.gameResultIcon}>{result.icon}</span>
                        <span className={styles.gameResultLabel} style={{ color: result.color }}>{result.label}</span>
                      </div>
                      <div className={styles.gameDetails}>
                        <div className={styles.gameOpponent}>vs. {opponent?.name || "Unknown"}</div>
                        <div className={styles.gameMeta}>
                          Playing as {myColor} · {game.endReason || "Finished"} · {formatDate(game.endedAt)}
                        </div>
                      </div>
                      <div className={styles.gamePointsDelta} style={{ color: result.color }}>
                        {result.label === "Win" ? "+25" : result.label === "Draw" ? "+5" : "−15"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Settings ── */}
        {activeTab === "settings" && (
          <div className={styles.tabContent}>
            <div className={styles.settingsGrid}>
              {/* Change name */}
              <div className={styles.settingCard}>
                <h3 className={styles.cardTitle}>✏️ Change Display Name</h3>
                <p className={styles.settingDesc}>Current: <strong style={{ color: "var(--gold, #f5c542)" }}>{userData?.name || user.displayName || user.email}</strong></p>
                <div className={styles.nameInputRow}>
                  <input
                    className={styles.nameInput}
                    type="text"
                    placeholder="New display name…"
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveName()}
                    maxLength={24}
                  />
                  <button
                    className={styles.saveBtn}
                    onClick={handleSaveName}
                    disabled={isSavingName || !newDisplayName.trim()}
                  >
                    {isSavingName ? "Saving…" : "Save"}
                  </button>
                </div>
                <div className={styles.nameHint}>{newDisplayName.length}/24 characters</div>
              </div>

              {/* Account info */}
              <div className={styles.settingCard}>
                <h3 className={styles.cardTitle}>👤 Account Info</h3>
                <div className={styles.accountInfo}>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>Email</span>
                    <span className={styles.accountValue}>{user.email}</span>
                  </div>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>Player ID</span>
                    <span className={styles.accountValue} style={{ color: "var(--gold, #f5c542)", fontFamily: "monospace" }}>
                      #{userData?.playerId || generatePlayerId(user.uid)}
                    </span>
                  </div>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>Member Since</span>
                    <span className={styles.accountValue}>{formatDate(userData?.createdAt)}</span>
                  </div>
                </div>

                <button className={styles.dangerBtn} onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

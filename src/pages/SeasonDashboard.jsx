import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/ecc-logo.png";
import { useClub } from "../hooks/useClub";

function formatDateWithDay(matchDate) {
  if (!matchDate) return "TBD";

  const date = new Date(`${matchDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return matchDate;
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isPastMatch(matchDate) {
  if (!matchDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matchDay = new Date(matchDate);
  matchDay.setHours(0, 0, 0, 0);

  return matchDay < today;
}

export default function SeasonDashboard() {
  const navigate = useNavigate();
  const { clubSlug, club, buildClubPath, dataSource, isLegacyEcc } = useClub();

  const sessionKey = `season_session_${clubSlug}`;

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [teamFilter, setTeamFilter] = useState("all");

  useEffect(() => {
    const savedSession = localStorage.getItem(sessionKey);

    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }

    fetchMatches();
  }, [sessionKey]);

  async function fetchMatches() {
    setLoading(true);

    let query = supabase
      .from(dataSource.dashboardView)
      .select("*");

    if (!isLegacyEcc) {
      query = query.eq("club_slug", clubSlug);
    }

    const { data, error } = await query
      .order("match_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching matches:", error);
      alert("Failed to load matches");
    } else {
      setMatches(data || []);
    }

    setLoading(false);
  }

  function normalizeTeam(value) {
    return String(value || "").replace(/\s+/g, "").toUpperCase();
  }

  const teams = useMemo(() => {
    return ["all", ...new Set(matches.map((m) => m.team).filter(Boolean))];
  }, [matches]);

  const visibleMatches = useMemo(() => {
    let result = matches;

    if (session?.role === "team_admin") {
      result = result.filter(
        (match) => normalizeTeam(match.team) === normalizeTeam(session.team)
      );
    }

    if ((session?.role === "super_admin" || !session) && teamFilter !== "all") {
      result = result.filter(
        (match) => normalizeTeam(match.team) === normalizeTeam(teamFilter)
      );
    }

    return result;
  }, [matches, session, teamFilter]);

  function logout() {
    localStorage.removeItem(sessionKey);
    setSession(null);
    setTeamFilter("all");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading season...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoWrap}>
              {isLegacyEcc ? <img src={logo} alt={`${club.shortName} Logo`} style={styles.logo} /> : <span style={styles.logoText}>{club.shortName}</span>}
            </div>

            <div style={styles.headerText}>
              <p style={styles.kicker}>{club.name}</p>
              <h1 style={styles.title}>{club.seasonTitle}</h1>
              <p style={styles.subtitle}>
                {session
                  ? session.role === "super_admin"
                    ? `Super Admin • ${session.personName}`
                    : `${session.team} Admin • ${session.personName}`
                  : `Public view • Select your ${club.shortName} team and update availability`}
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              style={styles.secondaryButton}
              onClick={() => navigate(buildClubPath("/availability/multiple"))}
            >
              📝 Update Multiple
            </button>

            {isLegacyEcc && (
              <>
                <button
                  style={styles.secondaryButton}
                  onClick={() => navigate("/fantasy-points")}
                >
                  🏆 Fantasy Points
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() => navigate("/kncb-stats")}
                >
                  📊 KNCB Stats
                </button>
              </>
            )}

            {!session ? (
              <button style={styles.darkButton} onClick={() => navigate(buildClubPath("/login"))}>
                🔐 Login
              </button>
            ) : (
              <button style={styles.logoutButton} onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </header>

        <section style={styles.noticeCard}>
          <div style={styles.noticeTextBox}>
            <h2 style={styles.noticeTitle}>{visibleMatches.length} matches visible</h2>
            <p style={styles.noticeText}>
              Past matches are greyed out and availability is closed.
            </p>
          </div>

          <div style={styles.filterBox}>
            {(session?.role === "super_admin" || !session) && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                style={styles.teamSelect}
              >
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team === "all" ? "All Teams" : team}
                  </option>
                ))}
              </select>
            )}

            <span style={styles.noticeBadge}>
              {session
                ? session.role === "super_admin"
                  ? "Super Admin"
                  : `${session.team} Admin`
                : "Public"}
            </span>
          </div>
        </section>

        <h2 style={styles.sectionTitle}>Upcoming Matches</h2>

        {visibleMatches.length === 0 ? (
          <div style={styles.emptyCard}>No matches found for this filter.</div>
        ) : (
          <div style={styles.matchGrid}>
            {visibleMatches.map((match) => {
              const past = isPastMatch(match.match_date);

              return (
                <article
                  key={match.match_id}
                  style={{
                    ...styles.matchCard,
                    ...(past ? styles.pastMatchCard : {}),
                  }}
                >
                  <div style={styles.cardTop}>
                    <span style={styles.teamBadge}>{match.team}</span>
                    <span style={past ? styles.closedBadge : styles.dateBadge}>
                      {past ? "Closed" : formatDateWithDay(match.match_date)}
                    </span>
                  </div>

                  <h3 style={styles.matchTitle}>
                    {match.team} vs {match.opponent}
                  </h3>

                  <div style={styles.infoList}>
                    <p style={styles.infoLine}>📅 {formatDateWithDay(match.match_date)}</p>
                    <p style={styles.infoLine}>⏰ {match.start_time || "TBD"}</p>
                    <p style={styles.infoLine}>
                      📍 {match.home_away?.toUpperCase()} • {match.venue}
                    </p>
                    <p style={styles.infoLine}>🏏 {match.division}</p>
                  </div>

                  <div style={styles.statsGrid}>
                    <MiniStat label="Total" value={match.total_players} />
                    <MiniStat label="Avail" value={match.available_count} tone="green" />
                    <MiniStat label="Maybe" value={match.maybe_count} tone="orange" />
                    <MiniStat label="Out" value={match.unavailable_count} tone="red" />
                  </div>

                  <div style={styles.actions}>
                    <button
                      style={{
                        ...styles.primaryButton,
                        ...(past ? styles.disabledButton : {}),
                      }}
                      disabled={past}
                      onClick={() => {
                        if (!past) navigate(buildClubPath(`/match/${match.match_id}`));
                      }}
                    >
                      {past
                        ? "Closed"
                        : session
                        ? "View Availability"
                        : "Update Availability"}
                    </button>

                    {session && (
                      <button
                        style={{
                          ...styles.successButton,
                          ...(past ? styles.disabledButton : {}),
                        }}
                        disabled={past}
                        onClick={() => {
                          if (!past) navigate(buildClubPath(`/match/${match.match_id}/squad`));
                        }}
                      >
                        {past ? "Closed" : "Build Squad"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const colorMap = {
    green: "#15803d",
    orange: "#d97706",
    red: "#dc2626",
  };

  return (
    <div style={styles.miniStat}>
      <p style={styles.miniLabel}>{label}</p>
      <h4 style={{ ...styles.miniValue, color: colorMap[tone] || "#111827" }}>
        {value ?? 0}
      </h4>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ecfdf5 100%)",
    padding: "10px",
    boxSizing: "border-box",
    overflowX: "hidden",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    boxSizing: "border-box",
  },

  loadingCard: {
    maxWidth: "420px",
    margin: "100px auto",
    background: "white",
    padding: "20px",
    borderRadius: "18px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
    textAlign: "center",
    fontWeight: "700",
  },

  header: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
    border: "1px solid rgba(226,232,240,0.95)",
    borderRadius: "20px",
    padding: "14px",
    marginBottom: "14px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "0",
    flex: "1 1 250px",
  },

  headerText: {
    minWidth: 0,
  },

  logoWrap: {
    width: "52px",
    height: "52px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fff7ed, #fde68a, #dcfce7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,0.14)",
    border: "1px solid rgba(255,255,255,0.9)",
    flexShrink: 0,
  },

  logo: {
    width: "42px",
    height: "42px",
    objectFit: "contain",
  },

  logoText: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: "11px",
    textAlign: "center",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: "900",
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  title: {
    margin: "3px 0",
    fontSize: "clamp(22px, 6vw, 34px)",
    lineHeight: "1.08",
    color: "#0f172a",
    fontWeight: "900",
    wordBreak: "break-word",
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: "1.35",
  },

  headerActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    flex: "1 1 220px",
    justifyContent: "flex-end",
  },

  secondaryButton: {
    flex: "1 1 140px",
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
    padding: "10px 10px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
    boxShadow: "0 6px 14px rgba(79,70,229,0.10)",
    whiteSpace: "nowrap",
  },

  darkButton: {
    flex: "1 1 90px",
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "10px 10px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
    boxShadow: "0 8px 18px rgba(15,23,42,0.20)",
    whiteSpace: "nowrap",
  },

  logoutButton: {
    flex: "1 1 90px",
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "10px 10px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
    boxShadow: "0 8px 18px rgba(220,38,38,0.20)",
    whiteSpace: "nowrap",
  },

  noticeCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "12px",
    marginBottom: "16px",
    boxShadow: "0 8px 18px rgba(15,23,42,0.07)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  noticeTextBox: {
    minWidth: 0,
    flex: "1 1 200px",
  },

  noticeTitle: {
    margin: 0,
    fontSize: "17px",
    color: "#0f172a",
  },

  noticeText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "1.35",
  },

  filterBox: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    flex: "1 1 190px",
    justifyContent: "flex-end",
  },

  teamSelect: {
    flex: "1 1 120px",
    padding: "9px 10px",
    borderRadius: "11px",
    border: "1px solid #cbd5e1",
    background: "white",
    fontWeight: "800",
    color: "#0f172a",
    fontSize: "12px",
    minWidth: "120px",
  },

  noticeBadge: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "8px 10px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "19px",
    color: "#0f172a",
  },

  matchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
    gap: "10px",
  },

  matchCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "12px",
    boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
    minWidth: 0,
  },

  pastMatchCard: {
    opacity: 0.55,
    background: "#f1f5f9",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  },

  teamBadge: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "5px 8px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "11px",
  },

  dateBadge: {
    background: "#f1f5f9",
    color: "#334155",
    padding: "5px 8px",
    borderRadius: "999px",
    fontWeight: "800",
    fontSize: "11px",
  },

  closedBadge: {
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "5px 8px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "11px",
  },

  matchTitle: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: "16px",
    lineHeight: "1.25",
  },

  infoList: {
    color: "#475569",
    fontSize: "11px",
    lineHeight: "1.25",
  },

  infoLine: {
    margin: "3px 0",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(54px, 1fr))",
    gap: "5px",
    marginTop: "10px",
  },

  miniStat: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "6px 3px",
    textAlign: "center",
  },

  miniLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: "9px",
    fontWeight: "800",
  },

  miniValue: {
    margin: "2px 0 0",
    fontSize: "15px",
  },

  actions: {
    display: "flex",
    gap: "7px",
    marginTop: "12px",
    flexWrap: "wrap",
  },

  primaryButton: {
    flex: "1 1 120px",
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "9px 10px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "800",
    fontSize: "12px",
  },

  successButton: {
    flex: "1 1 110px",
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "9px 10px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "800",
    fontSize: "12px",
  },

  disabledButton: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },

  emptyCard: {
    background: "white",
    borderRadius: "16px",
    padding: "22px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "700",
  },
};
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/ecc-logo.png";

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

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [teamFilter, setTeamFilter] = useState("all");

  useEffect(() => {
    const savedSession = localStorage.getItem("ecc_season_session");

    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch {
        localStorage.removeItem("ecc_season_session");
      }
    }

    fetchMatches();
  }, []);

  async function fetchMatches() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ecc_season_match_dashboard")
      .select("*")
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
    localStorage.removeItem("ecc_season_session");
    setSession(null);
    setTeamFilter("all");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading ECC season...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoWrap}>
              <img src={logo} alt="ECC Logo" style={styles.logo} />
            </div>

            <div>
              <p style={styles.kicker}>Eindhoven Cricket Club</p>
              <h1 style={styles.title}>ECC Season 2026</h1>
              <p style={styles.subtitle}>
                {session
                  ? session.role === "super_admin"
                    ? `Super Admin • ${session.personName}`
                    : `${session.team} Admin • ${session.personName}`
                  : "Public view • Select your team and update availability"}
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              style={styles.secondaryButton}
              onClick={() => navigate("/availability/multiple")}
            >
              📝 Update Multiple Matches
            </button>

            {!session ? (
              <button style={styles.darkButton} onClick={() => navigate("/login")}>
                🔐 Captain / Admin Login
              </button>
            ) : (
              <button style={styles.logoutButton} onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </header>

        <section style={styles.noticeCard}>
          <div>
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
                : "Public View"}
            </span>
          </div>
        </section>

        <div style={styles.sectionTitleRow}>
          <h2 style={styles.sectionTitle}>Upcoming Matches</h2>
        </div>

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
                      {past ? "Closed" : match.match_date}
                    </span>
                  </div>

                  <h3 style={styles.matchTitle}>
                    {match.team} vs {match.opponent}
                  </h3>

                  <div style={styles.infoList}>
                    <p>📅 {match.match_date}</p>
                    <p>⏰ {match.start_time || "TBD"}</p>
                    <p>📍 {match.home_away?.toUpperCase()} • {match.venue}</p>
                    <p>🏏 {match.division}</p>
                  </div>

                  <div style={styles.statsGrid}>
                    <MiniStat label="Total" value={match.total_players} />
                    <MiniStat label="Available" value={match.available_count} tone="green" />
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
                        if (!past) navigate(`/match/${match.match_id}`);
                      }}
                    >
                      {past
                        ? "Match Closed"
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
                          if (!past) navigate(`/match/${match.match_id}/squad`);
                        }}
                      >
                        {past ? "Squad Closed" : "Build Squad"}
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
    padding: "24px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },
  loadingCard: {
    maxWidth: "420px",
    margin: "100px auto",
    background: "white",
    padding: "24px",
    borderRadius: "18px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
    textAlign: "center",
    fontWeight: "700",
  },

  header: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
    border: "1px solid rgba(226,232,240,0.95)",
    borderRadius: "28px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  logoWrap: {
    width: "72px",
    height: "72px",
    borderRadius: "22px",
    background: "linear-gradient(135deg, #fff7ed, #fde68a, #dcfce7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 28px rgba(15,23,42,0.16)",
    border: "1px solid rgba(255,255,255,0.9)",
  },
  logo: {
    width: "58px",
    height: "58px",
    objectFit: "contain",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: "900",
    fontSize: "13px",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0",
    fontSize: "38px",
    lineHeight: "1.05",
    color: "#0f172a",
    fontWeight: "900",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
    fontWeight: "600",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  secondaryButton: {
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
    padding: "13px 16px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "900",
    boxShadow: "0 8px 18px rgba(79,70,229,0.12)",
  },
  darkButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "13px 16px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "900",
    boxShadow: "0 10px 22px rgba(15,23,42,0.22)",
  },
  logoutButton: {
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "13px 16px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "900",
    boxShadow: "0 10px 22px rgba(220,38,38,0.22)",
  },

  noticeCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "18px 20px",
    marginBottom: "26px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  noticeTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a",
  },
  noticeText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  filterBox: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  teamSelect: {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "white",
    fontWeight: "800",
    color: "#0f172a",
  },
  noticeBadge: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "8px 13px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "13px",
  },
  sectionTitleRow: {
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a",
  },
  matchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  matchCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
  },
  pastMatchCard: {
    opacity: 0.55,
    background: "#f1f5f9",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "14px",
  },
  teamBadge: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "7px 11px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "13px",
  },
  dateBadge: {
    background: "#f1f5f9",
    color: "#334155",
    padding: "7px 11px",
    borderRadius: "999px",
    fontWeight: "800",
    fontSize: "13px",
  },
  closedBadge: {
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "7px 11px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "13px",
  },
  matchTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: "21px",
  },
  infoList: {
    color: "#475569",
    fontSize: "14px",
    lineHeight: "1.4",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    marginTop: "16px",
  },
  miniStat: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "10px",
    textAlign: "center",
  },
  miniLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
  },
  miniValue: {
    margin: "4px 0 0",
    fontSize: "20px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "18px",
    flexWrap: "wrap",
  },
  primaryButton: {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "11px 14px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "800",
  },
  successButton: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "11px 14px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "800",
  },
  disabledButton: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },
  emptyCard: {
    background: "white",
    borderRadius: "18px",
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "700",
  },
};
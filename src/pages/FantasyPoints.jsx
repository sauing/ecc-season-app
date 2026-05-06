import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const LEAGUE_ID = "04cae0eb-16ff-45f3-ab02-0422b347eb85";
const LEAGUE_CODE = "0RPJJR";

function firstValue(row, keys, fallback = null) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function FantasyPoints() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(["all"]);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    fetchFantasyPoints();
  }, []);

  async function fetchFantasyPoints() {
    setLoading(true);
    setErrorText("");

    try {
      const { data: leagueMembers, error: membersError } = await supabase
        .from("league_members")
        .select("*")
        .eq("league_id", LEAGUE_ID);

      if (membersError) throw membersError;

      const { data: teamPlayers, error: teamPlayersError } = await supabase
        .from("team_players")
        .select("*")
        .eq("league_id", LEAGUE_ID);

      if (teamPlayersError) throw teamPlayersError;

      const playerIds = [
        ...new Set(
          (teamPlayers || [])
            .map((row) => firstValue(row, ["player_id", "playerId"]))
            .filter(Boolean)
        ),
      ];

      if (playerIds.length === 0) {
        setPlayers([]);
        setTeams(["all"]);
        return;
      }

      const { data: playerRows, error: playersError } = await supabase
        .from("players")
        .select("*")
        .in("id", playerIds);

      if (playersError) throw playersError;

      const { data: statsRows, error: statsError } = await supabase
        .from("player_match_stats")
        .select("*")
        .in("player_id", playerIds);

      if (statsError) throw statsError;

      const memberById = new Map();
      (leagueMembers || []).forEach((member) => {
        memberById.set(String(member.id), member);
      });

      const playerById = new Map();
      (playerRows || []).forEach((player) => {
        playerById.set(String(player.id), player);
      });

      const pointsByPlayerId = new Map();
      (statsRows || []).forEach((stat) => {
        const playerId = firstValue(stat, ["player_id", "playerId"]);
        if (!playerId) return;

        const fantasyPoints = toNumber(
          firstValue(stat, ["fantasy_points", "points", "total_points"], 0)
        );

        pointsByPlayerId.set(
          String(playerId),
          (pointsByPlayerId.get(String(playerId)) || 0) + fantasyPoints
        );
      });

      const rows = (teamPlayers || []).map((teamPlayer) => {
        const playerId = firstValue(teamPlayer, ["player_id", "playerId"]);
        const player = playerById.get(String(playerId)) || {};

        const memberId = firstValue(teamPlayer, [
          "league_member_id",
          "member_id",
          "team_id",
          "owner_id",
          "user_id",
        ]);

        const member = memberById.get(String(memberId)) || {};

        const teamName =
          firstValue(member, [
            "team_name",
            "name",
            "display_name",
            "member_name",
            "user_name",
            "owner_name",
          ]) ||
          firstValue(teamPlayer, [
            "team_name",
            "team",
            "owner_name",
            "member_name",
            "user_name",
          ]) ||
          "Unknown Team";

        return {
          playerId,
          playerName:
            firstValue(player, ["name", "player_name", "full_name"]) ||
            firstValue(teamPlayer, ["player_name", "name"]) ||
            "Unknown Player",
          teamName,
          fantasyPoints: pointsByPlayerId.get(String(playerId)) || 0,
        };
      });

      const uniqueRowsMap = new Map();
      rows.forEach((row) => {
        uniqueRowsMap.set(`${row.playerId}-${normalize(row.teamName)}`, row);
      });

      const finalRows = [...uniqueRowsMap.values()].sort((a, b) => {
        if (b.fantasyPoints !== a.fantasyPoints) {
          return b.fantasyPoints - a.fantasyPoints;
        }
        return a.playerName.localeCompare(b.playerName);
      });

      setPlayers(finalRows);
      setTeams([
        "all",
        ...new Set(finalRows.map((row) => row.teamName).filter(Boolean)),
      ]);
    } catch (error) {
      console.error("Fantasy points loading error:", error);
      setErrorText(error.message || "Failed to load fantasy points.");
    } finally {
      setLoading(false);
    }
  }

  const visiblePlayers = useMemo(() => {
    if (selectedTeam === "all") return players;
    return players.filter((player) => player.teamName === selectedTeam);
  }, [players, selectedTeam]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>League Code: {LEAGUE_CODE}</p>
            <h1 style={styles.title}>Fantasy Points</h1>
            <p style={styles.subtitle}>
              Points are read directly from Supabase for league {LEAGUE_CODE}.
              Click Refresh after points are updated in the fantasy app.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button style={styles.secondaryButton} onClick={fetchFantasyPoints}>
              🔄 Refresh Points
            </button>
            <button style={styles.darkButton} onClick={() => navigate("/")}>
              ← Dashboard
            </button>
          </div>
        </header>

        <section style={styles.filterCard}>
          <div>
            <h2 style={styles.cardTitle}>Select Team</h2>
            <p style={styles.smallText}>
              Showing {visiblePlayers.length} players from {players.length} total players.
            </p>
          </div>

          <select
            value={selectedTeam}
            onChange={(event) => setSelectedTeam(event.target.value)}
            style={styles.select}
          >
            {teams.map((team) => (
              <option key={team} value={team}>
                {team === "all" ? "Overall Leaderboard" : team}
              </option>
            ))}
          </select>
        </section>

        {loading ? (
          <div style={styles.messageCard}>Loading fantasy points...</div>
        ) : errorText ? (
          <div style={styles.errorCard}>
            <h3 style={styles.errorTitle}>Could not load fantasy points</h3>
            <p style={styles.errorText}>{errorText}</p>
            <p style={styles.errorText}>
              Share screenshots of columns from league_members, team_players,
              players, and player_match_stats if this error stays.
            </p>
          </div>
        ) : visiblePlayers.length === 0 ? (
          <div style={styles.messageCard}>No fantasy points found.</div>
        ) : (
          <div style={styles.tableCard}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>Player</th>
                    <th style={styles.th}>Team</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Fantasy Points</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlayers.map((player, index) => (
                    <tr key={`${player.playerId}-${player.teamName}`} style={styles.tr}>
                      <td style={styles.td}>{index + 1}</td>
                      <td style={styles.playerTd}>{player.playerName}</td>
                      <td style={styles.td}>{player.teamName}</td>
                      <td style={styles.pointsTd}>{player.fantasyPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ecfdf5 100%)",
    padding: "10px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: { width: "100%", maxWidth: "1180px", margin: "0 auto" },
  header: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "12px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
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
    margin: "4px 0",
    fontSize: "clamp(24px, 6vw, 34px)",
    color: "#0f172a",
    fontWeight: "900",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: "1.4",
  },
  headerActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  secondaryButton: {
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
    padding: "10px 12px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
  },
  darkButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "10px 12px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
  },
  filterCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "12px",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
  },
  cardTitle: { margin: 0, color: "#0f172a", fontSize: "17px" },
  smallText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
  },
  select: {
    flex: "1 1 220px",
    maxWidth: "360px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontWeight: "800",
    color: "#0f172a",
    background: "white",
  },
  tableCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
  },
  tableScroll: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "620px" },
  th: {
    background: "#f8fafc",
    color: "#334155",
    padding: "11px 10px",
    fontSize: "12px",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
  },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: {
    padding: "10px",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "700",
  },
  playerTd: {
    padding: "10px",
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "900",
  },
  pointsTd: {
    padding: "10px",
    color: "#15803d",
    fontSize: "14px",
    fontWeight: "900",
    textAlign: "right",
  },
  messageCard: {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "800",
  },
  errorCard: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: "16px",
    padding: "16px",
  },
  errorTitle: { margin: "0 0 8px", color: "#be123c" },
  errorText: {
    margin: "4px 0",
    color: "#9f1239",
    fontWeight: "700",
    fontSize: "13px",
  },
};

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/ecc-logo.png";

const LAST_PLAYER_KEY = "ecc_last_selected_player";

function isPastMatch(matchDate) {
  if (!matchDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matchDay = new Date(matchDate);
  matchDay.setHours(0, 0, 0, 0);

  return matchDay < today;
}

export default function MatchAvailability() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState(
    localStorage.getItem(LAST_PLAYER_KEY) || ""
  );
  const [selectedStatus, setSelectedStatus] = useState("available");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const pastMatch = isPastMatch(match?.match_date);

  useEffect(() => {
    fetchMatchAvailability();
  }, [matchId]);

  async function fetchMatchAvailability() {
    setLoading(true);

    const { data: matchData, error: matchError } = await supabase
      .from("ecc_season_match_dashboard")
      .select("*")
      .eq("match_id", matchId)
      .single();

    if (matchError) {
      console.error("Error loading match:", matchError);
      alert("Could not load match details");
      setLoading(false);
      return;
    }

    setMatch(matchData);

    const { data, error } = await supabase
      .from("ecc_season_match_availability_view")
      .select("*")
      .eq("match_id", matchId)
      .order("player_team", { ascending: true })
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error loading availability:", error);
      alert("Could not load availability");
      setLoading(false);
      return;
    }

    const formatted = (data || []).map((x) => ({
      id: x.availability_id,
      player_id: x.player_id,
      full_name: x.full_name,
      player_team: x.player_team || "Unknown",
      status: x.status || "maybe",
      comment: x.comment || "",
    }));

    setPlayers(formatted);

    const savedPlayerId = localStorage.getItem(LAST_PLAYER_KEY);

    if (savedPlayerId) {
      const savedPlayer = formatted.find(
        (p) => String(p.player_id) === String(savedPlayerId)
      );

      if (savedPlayer) {
        setSelectedPlayer(savedPlayer.player_id);
        setSelectedStatus(savedPlayer.status || "maybe");
        setComment(savedPlayer.comment || "");
      }
    }

    setLoading(false);
  }

  const teams = useMemo(() => {
    return ["all", ...new Set(players.map((p) => p.player_team))];
  }, [players]);

  const filteredPlayers = players.filter((p) => {
    const statusOk = statusFilter === "all" || p.status === statusFilter;
    const teamOk = teamFilter === "all" || p.player_team === teamFilter;
    return statusOk && teamOk;
  });

  const selectedPlayerData = players.find(
    (p) => String(p.player_id) === String(selectedPlayer)
  );

  async function handleSaveAvailability() {
    if (pastMatch) {
      alert("Availability is closed because this match date has passed.");
      return;
    }

    if (!selectedPlayer) {
      alert("Please select your name");
      return;
    }

    if (!selectedStatus) {
      alert("Please select availability status");
      return;
    }

    setSaving(true);

    const existingRow = players.find(
      (p) => String(p.player_id) === String(selectedPlayer)
    );

    const payload = {
      match_id: matchId,
      player_id: selectedPlayer,
      status: selectedStatus,
      comment: comment.trim() || null,
    };

    let error;

    if (existingRow?.id) {
      const response = await supabase
        .from("ecc_season_match_availability")
        .update(payload)
        .eq("id", existingRow.id);

      error = response.error;
    } else {
      const response = await supabase
        .from("ecc_season_match_availability")
        .insert(payload);

      error = response.error;
    }

    setSaving(false);

    if (error) {
      console.error("Error saving availability:", error);
      alert("Failed to save availability");
      return;
    }

    localStorage.setItem(LAST_PLAYER_KEY, selectedPlayer);
    alert("Availability updated successfully");
    await fetchMatchAvailability();
  }

  function handlePlayerChange(playerId) {
    setSelectedPlayer(playerId);

    if (!playerId) {
      localStorage.removeItem(LAST_PLAYER_KEY);
      setSelectedStatus("available");
      setComment("");
      return;
    }

    localStorage.setItem(LAST_PLAYER_KEY, playerId);

    const player = players.find((p) => String(p.player_id) === String(playerId));

    if (player) {
      setSelectedStatus(player.status || "maybe");
      setComment(player.comment || "");
    }
  }

  function getStatusStyle(status) {
    if (status === "available") return styles.availableCard;
    if (status === "unavailable") return styles.unavailableCard;
    return styles.maybeCard;
  }

  function getStatusLabel(status) {
    if (status === "available") return "✅ Available";
    if (status === "unavailable") return "❌ Unavailable";
    return "🟡 Maybe";
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>Loading availability...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <button onClick={() => navigate("/")} style={styles.backButton}>
          ← Back
        </button>

        {match && (
          <div
            style={{
              ...styles.matchCard,
              ...(pastMatch ? styles.pastMatchCard : {}),
            }}
          >
            <div>
              <div style={styles.headerLeft}>
                <div style={styles.logoWrap}>
                  <img src={logo} alt="ECC Logo" style={styles.logo} />
                </div>

                <div>
                  <p style={styles.kicker}>Match Availability</p>
                  <h1 style={styles.title}>
                    {match.team} vs {match.opponent}
                  </h1>

                  {pastMatch && (
                    <span style={styles.closedBadge}>Availability Closed</span>
                  )}
                </div>
              </div>

              <p style={styles.meta}>
                📅 {match.match_date} | ⏰ {match.start_time || "TBD"}
              </p>

              <p style={styles.meta}>
                📍 {match.home_away?.toUpperCase()} • {match.venue}
              </p>

              <p style={styles.meta}>🏏 {match.division}</p>
            </div>

            <div style={styles.countGrid}>
              <CountBox label="Available" value={match.available_count} tone="green" />
              <CountBox label="Maybe" value={match.maybe_count} tone="orange" />
              <CountBox label="Unavailable" value={match.unavailable_count} tone="red" />
            </div>
          </div>
        )}

        <div
          style={{
            ...styles.selfUpdateCard,
            ...(pastMatch ? styles.closedUpdateCard : {}),
          }}
        >
          <div style={styles.selfUpdateHeader}>
            <div>
              <h2 style={styles.cardTitle}>Update Your Availability</h2>
              <p style={styles.cardHint}>
                {pastMatch
                  ? "This match date has passed, so availability update is closed."
                  : "Your last selected player is remembered on this device."}
              </p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Your Name</label>
              <select
                value={selectedPlayer}
                onChange={(e) => handlePlayerChange(e.target.value)}
                style={styles.input}
                disabled={pastMatch}
              >
                <option value="">Select your name</option>
                {players.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.full_name} ({p.player_team})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={styles.input}
                disabled={pastMatch}
              >
                <option value="available">Available</option>
                <option value="maybe">Maybe</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Note</label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional note"
                style={styles.input}
                disabled={pastMatch}
              />
            </div>

            <button
              onClick={handleSaveAvailability}
              disabled={saving || pastMatch}
              style={{
                ...styles.saveButton,
                ...(pastMatch ? styles.disabledButton : {}),
                opacity: saving || pastMatch ? 0.7 : 1,
                cursor: saving || pastMatch ? "not-allowed" : "pointer",
              }}
            >
              {pastMatch ? "Availability Closed" : saving ? "Saving..." : "Save Availability"}
            </button>
          </div>

          {selectedPlayerData && (
            <p style={styles.currentStatus}>
              Current status:{" "}
              <strong>{getStatusLabel(selectedPlayerData.status)}</strong>
            </p>
          )}
        </div>

        <div style={styles.filterCard}>
          <div>
            <h2 style={styles.cardTitle}>All Player Availability</h2>
            <p style={styles.cardHint}>Your selected player row is highlighted.</p>
          </div>

          <div style={styles.filters}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.filterInput}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="maybe">Maybe</option>
              <option value="unavailable">Unavailable</option>
            </select>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={styles.filterInput}
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team === "all" ? "All Teams" : team}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.playerGrid}>
          {filteredPlayers.map((p) => (
            <div
              key={p.player_id}
              style={{
                ...styles.playerCard,
                ...getStatusStyle(p.status),
                ...(String(p.player_id) === String(selectedPlayer)
                  ? styles.myPlayerCard
                  : {}),
              }}
            >
              <div style={styles.playerTop}>
                <strong style={styles.playerName}>{p.full_name}</strong>
                <span style={styles.teamBadge}>{p.player_team}</span>
              </div>

              <div style={styles.statusText}>{getStatusLabel(p.status)}</div>

              {p.comment && <div style={styles.comment}>Note: {p.comment}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountBox({ label, value, tone }) {
  const colorMap = {
    green: "#15803d",
    orange: "#d97706",
    red: "#dc2626",
  };

  return (
    <div style={styles.countBox}>
      <p style={styles.countLabel}>{label}</p>
      <h3 style={{ ...styles.countValue, color: colorMap[tone] }}>
        {value ?? 0}
      </h3>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 50%, #ecfdf5 100%)",
    padding: "24px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  loadingCard: {
    maxWidth: "420px",
    margin: "100px auto",
    background: "white",
    padding: "24px",
    borderRadius: "18px",
    textAlign: "center",
    fontWeight: "800",
    boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
  },
  backButton: {
    marginBottom: "16px",
    background: "white",
    border: "1px solid #d1d5db",
    padding: "10px 14px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "800",
    color: "#111827",
  },
  matchCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    padding: "22px",
    marginBottom: "18px",
    boxShadow: "0 14px 36px rgba(15,23,42,0.10)",
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
  },
  pastMatchCard: {
    opacity: 0.65,
    background: "#f1f5f9",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "10px",
  },
  logoWrap: {
    width: "64px",
    height: "64px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #fff7ed, #fde68a, #dcfce7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
    border: "1px solid rgba(255,255,255,0.8)",
  },
  logo: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontWeight: "900",
    fontSize: "13px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "30px",
    color: "#0f172a",
  },
  meta: {
    margin: "5px 0",
    color: "#475569",
    fontSize: "14px",
  },
  closedBadge: {
    display: "inline-block",
    marginTop: "8px",
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "7px 11px",
    borderRadius: "999px",
    fontWeight: "900",
    fontSize: "13px",
  },
  countGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(110px, 1fr))",
    gap: "10px",
    minWidth: "330px",
  },
  countBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "12px",
    textAlign: "center",
  },
  countLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
  },
  countValue: {
    margin: "6px 0 0",
    fontSize: "24px",
  },
  selfUpdateCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "20px",
    marginBottom: "18px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
  },
  closedUpdateCard: {
    background: "#f8fafc",
  },
  selfUpdateHeader: {
    marginBottom: "14px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#0f172a",
  },
  cardHint: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 2fr auto",
    gap: "12px",
    alignItems: "end",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "800",
  },
  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "white",
  },
  saveButton: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "12px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
    whiteSpace: "nowrap",
  },
  disabledButton: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },
  currentStatus: {
    margin: "12px 0 0",
    color: "#334155",
    fontSize: "14px",
  },
  filterCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "18px",
    marginBottom: "16px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  filters: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  filterInput: {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "white",
    fontWeight: "700",
  },
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
  },
  playerCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "14px",
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
  },
  myPlayerCard: {
    border: "2px solid #2563eb",
    boxShadow: "0 0 0 4px rgba(37,99,235,0.12)",
  },
  availableCard: {
    background: "#ecfdf5",
  },
  maybeCard: {
    background: "#fffbeb",
  },
  unavailableCard: {
    background: "#fef2f2",
  },
  playerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  },
  playerName: {
    color: "#0f172a",
    fontSize: "15px",
  },
  teamBadge: {
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.45)",
    borderRadius: "999px",
    padding: "5px 8px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: "900",
    whiteSpace: "nowrap",
  },
  statusText: {
    color: "#334155",
    fontSize: "14px",
    fontWeight: "800",
  },
  comment: {
    marginTop: "8px",
    color: "#475569",
    fontSize: "13px",
  },
};
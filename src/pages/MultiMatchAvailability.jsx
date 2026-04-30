import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/ecc-logo.png";

const LAST_PLAYER_KEY = "ecc_last_selected_player";

export default function MultiMatchAvailability() {
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(
    localStorage.getItem(LAST_PLAYER_KEY) || ""
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [availabilityIdMap, setAvailabilityIdMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      localStorage.setItem(LAST_PLAYER_KEY, selectedPlayer);
      fetchPlayerAvailability(selectedPlayer);
    }
  }, [selectedPlayer]);

  async function fetchInitialData() {
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    const { data: playersData, error: playersError } = await supabase
      .from("ecc_season_players")
      .select("*")
      .order("full_name", { ascending: true });

    if (playersError) {
      console.error(playersError);
      alert("Could not load players");
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from("ecc_season_match_dashboard")
      .select("*")
      .gte("match_date", today)
      .order("match_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      alert("Could not load matches");
    }

    setPlayers(playersData || []);
    setMatches(matchesData || []);
    setLoading(false);
  }

  async function fetchPlayerAvailability(playerId) {
    const { data, error } = await supabase
      .from("ecc_season_match_availability")
      .select("*")
      .eq("player_id", playerId);

    if (error) {
      console.error(error);
      alert("Could not load saved availability");
      return;
    }

    const statusMap = {};
    const idMap = {};

    (data || []).forEach((row) => {
      statusMap[row.match_id] = row.status || "maybe";
      idMap[row.match_id] = row.id;
    });

    setAvailabilityMap(statusMap);
    setAvailabilityIdMap(idMap);
  }

  const filteredPlayers = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();

    if (!search) return players;

    return players.filter((p) =>
      String(p.full_name || "").toLowerCase().includes(search)
    );
  }, [players, playerSearch]);

  const selectedPlayerData = useMemo(() => {
    return players.find((p) => String(p.id) === String(selectedPlayer));
  }, [players, selectedPlayer]);

  function handleStatusChange(matchId, status) {
    setAvailabilityMap((prev) => ({
      ...prev,
      [matchId]: status,
    }));
  }

  async function saveAll() {
    if (!selectedPlayer) {
      alert("Please select your name first");
      return;
    }

    setSaving(true);

    for (const match of matches) {
      const status = availabilityMap[match.match_id] || "maybe";
      const existingId = availabilityIdMap[match.match_id];

      if (existingId) {
        const { error } = await supabase
          .from("ecc_season_match_availability")
          .update({
            status,
          })
          .eq("id", existingId);

        if (error) {
          console.error(error);
          alert("Some availability rows could not be updated");
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from("ecc_season_match_availability")
          .insert({
            match_id: match.match_id,
            player_id: selectedPlayer,
            status,
          });

        if (error) {
          console.error(error);
          alert("Some availability rows could not be saved");
          setSaving(false);
          return;
        }
      }
    }

    await fetchPlayerAvailability(selectedPlayer);
    setSaving(false);
    alert("Availability saved for all upcoming matches!");
  }

  function getStatusStyle(status) {
    if (status === "available") return styles.availableSelect;
    if (status === "unavailable") return styles.unavailableSelect;
    return styles.maybeSelect;
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
          ← Back to Dashboard
        </button>

        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoWrap}>
              <img src={logo} alt="ECC Logo" style={styles.logo} />
            </div>

            <div>
              <p style={styles.kicker}>Eindhoven Cricket Club</p>
              <h1 style={styles.title}>Update Multiple Matches</h1>
              <p style={styles.subtitle}>
                Select your name once and update all upcoming match availability.
              </p>
            </div>
          </div>
        </header>

        <section style={styles.playerCard}>
          <div>
            <h2 style={styles.cardTitle}>Select Your Name</h2>
            <p style={styles.cardHint}>
              Search your name, then choose it from the dropdown.
            </p>
          </div>

          <div style={styles.playerForm}>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search name..."
              style={styles.searchInput}
            />

            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              style={styles.playerSelect}
            >
              <option value="">Select player</option>
              {filteredPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          {selectedPlayerData && (
            <div style={styles.selectedPlayerBox}>
              Selected: <strong>{selectedPlayerData.full_name}</strong>
            </div>
          )}
        </section>

        {!selectedPlayer ? (
          <div style={styles.emptyCard}>
            Select your name to see and update upcoming matches.
          </div>
        ) : (
          <>
            <section style={styles.noticeCard}>
              <div>
                <h2 style={styles.noticeTitle}>
                  {matches.length} upcoming matches
                </h2>
                <p style={styles.noticeText}>
                  Default value is Maybe. Change only what you need, then save all.
                </p>
              </div>

              <button
                onClick={saveAll}
                disabled={saving}
                style={{
                  ...styles.saveButton,
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save All Availability"}
              </button>
            </section>

            <div style={styles.matchList}>
              {matches.map((match) => {
                const status = availabilityMap[match.match_id] || "maybe";

                return (
                  <div key={match.match_id} style={styles.matchRow}>
                    <div>
                      <div style={styles.matchTitle}>
                        {match.team} vs {match.opponent}
                      </div>

                      <div style={styles.matchMeta}>
                        📅 {match.match_date} • ⏰ {match.start_time || "TBD"} •{" "}
                        📍 {match.home_away?.toUpperCase()} • {match.venue}
                      </div>
                    </div>

                    <select
                      value={status}
                      onChange={(e) =>
                        handleStatusChange(match.match_id, e.target.value)
                      }
                      style={{
                        ...styles.statusSelect,
                        ...getStatusStyle(status),
                      }}
                    >
                      <option value="available">Available</option>
                      <option value="maybe">Maybe</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div style={styles.bottomBar}>
              <button
                onClick={saveAll}
                disabled={saving}
                style={{
                  ...styles.saveButton,
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save All Availability"}
              </button>
            </div>
          </>
        )}
      </div>
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
  header: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 14px 36px rgba(15,23,42,0.10)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
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
    margin: "6px 0",
    fontSize: "34px",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },
  playerCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "20px",
    marginBottom: "18px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#0f172a",
  },
  cardHint: {
    margin: "5px 0 14px",
    color: "#64748b",
    fontSize: "14px",
  },
  playerForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  searchInput: {
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
  },
  playerSelect: {
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
    background: "white",
  },
  selectedPlayerBox: {
    marginTop: "12px",
    background: "#ecfdf5",
    color: "#047857",
    padding: "10px 12px",
    borderRadius: "12px",
    fontWeight: "700",
  },
  noticeCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "18px 20px",
    marginBottom: "16px",
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
  saveButton: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "12px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "900",
  },
  matchList: {
    display: "grid",
    gap: "12px",
  },
  matchRow: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "16px",
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
    display: "grid",
    gridTemplateColumns: "1fr 190px",
    gap: "12px",
    alignItems: "center",
  },
  matchTitle: {
    fontSize: "17px",
    fontWeight: "900",
    color: "#0f172a",
  },
  matchMeta: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "14px",
  },
  statusSelect: {
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontWeight: "900",
    cursor: "pointer",
  },
  availableSelect: {
    background: "#dcfce7",
    color: "#15803d",
  },
  maybeSelect: {
    background: "#fef3c7",
    color: "#b45309",
  },
  unavailableSelect: {
    background: "#fee2e2",
    color: "#b91c1c",
  },
  emptyCard: {
    background: "white",
    borderRadius: "18px",
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "700",
  },
  bottomBar: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "flex-end",
  },
};
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClub } from "../hooks/useClub";
import { supabase } from "../supabaseClient";
import logo from "../assets/ecc-logo.png";

const DEFAULT_LAST_PLAYER_KEY = "ecc_last_selected_player";

export default function MultiMatchAvailability() {
  const navigate = useNavigate();
  const { clubSlug, club, buildClubPath, dataSource, isLegacyEcc } = useClub();

  const lastPlayerKey = `${clubSlug}_last_selected_player`;

  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(
    localStorage.getItem(lastPlayerKey) || ""
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [availabilityIdMap, setAvailabilityIdMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolvedClubId, setResolvedClubId] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;
    if (!isLegacyEcc && !resolvedClubId) return;

    localStorage.setItem(lastPlayerKey, selectedPlayer);
    fetchPlayerAvailability(selectedPlayer);
  }, [selectedPlayer, resolvedClubId]);

  async function resolveClubId() {
    if (isLegacyEcc) return null;

    if (resolvedClubId) {
      return resolvedClubId;
    }

    const { data, error } = await supabase
      .from("clubs")
      .select("id")
      .eq("slug", clubSlug)
      .eq("is_active", true)
      .single();

    if (error || !data?.id) {
      console.error("Could not resolve club id:", error);
      alert("Could not resolve club");
      return null;
    }

    setResolvedClubId(data.id);
    return data.id;
  }

  async function fetchInitialData() {
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];
    const activeClubId = isLegacyEcc ? null : await resolveClubId();

    let playersData = [];
    let playersError = null;

    if (isLegacyEcc) {
      const response = await supabase
        .from(dataSource.playersTable)
        .select("*")
        .order("full_name", { ascending: true });

      playersData = response.data || [];
      playersError = response.error;
    } else {
      const response = await supabase
        .from(dataSource.availabilityView)
        .select("player_id, full_name")
        .eq("club_slug", clubSlug)
        .gte("match_date", today)
        .order("full_name", { ascending: true });

      playersError = response.error;

      const uniquePlayers = new Map();
      (response.data || []).forEach((row) => {
        if (row.player_id && row.full_name) {
          uniquePlayers.set(row.player_id, {
            id: row.player_id,
            full_name: row.full_name,
          });
        }
      });

      playersData = [...uniquePlayers.values()].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
    }

    if (playersError) {
      console.error(playersError);
      alert("Could not load players");
    }

    let matchesQuery = supabase
      .from(dataSource.dashboardView)
      .select("*")
      .gte("match_date", today);

    if (!isLegacyEcc) {
      matchesQuery = matchesQuery.eq("club_slug", clubSlug);
    }

    const { data: matchesData, error: matchesError } = await matchesQuery
      .order("match_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      alert("Could not load matches");
    }

    const normalizedMatches = (matchesData || []).map((match) => ({
      ...match,
      ...(!isLegacyEcc ? { club_id: match.club_id || activeClubId } : {}),
    }));

    setPlayers(playersData || []);
    setMatches(normalizedMatches);
    setLoading(false);

    if (selectedPlayer && (isLegacyEcc || activeClubId)) {
      await fetchPlayerAvailability(selectedPlayer, activeClubId);
    }
  }

  async function fetchPlayerAvailability(playerId, clubIdOverride = null) {
    if (isLegacyEcc) {
      const { data, error } = await supabase
        .from(dataSource.availabilityTable)
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
      return;
    }

    // Generic clubs: read from the same view used by the single match page.
    // This keeps Multi Availability synced with Match Availability.
    const clubId = clubIdOverride || resolvedClubId || (await resolveClubId());

    if (!clubId) {
      setAvailabilityMap({});
      setAvailabilityIdMap({});
      return;
    }

    const { data, error } = await supabase
      .from(dataSource.availabilityView)
      .select("match_id, status")
      .eq("club_slug", clubSlug)
      .eq("player_id", playerId);

    if (error) {
      console.error(error);
      alert("Could not load saved availability");
      return;
    }

    const statusMap = {};

    (data || []).forEach((row) => {
      statusMap[row.match_id] = row.status || "maybe";
    });

    setAvailabilityMap(statusMap);
    setAvailabilityIdMap({});
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

    const activeClubId = isLegacyEcc ? null : await resolveClubId();

    if (!isLegacyEcc && !activeClubId) {
      alert("Could not resolve club before saving");
      setSaving(false);
      return;
    }

    if (!isLegacyEcc) {
      const rows = matches.map((match) => ({
        club_id: match.club_id || activeClubId,
        match_id: match.match_id,
        player_id: selectedPlayer,
        status: availabilityMap[match.match_id] || "maybe",
      }));

      const { error } = await supabase
        .from(dataSource.availabilityTable)
        .upsert(rows, { onConflict: "match_id,player_id" });

      if (error) {
        console.error(error);
        alert(`Availability could not be saved: ${error.message}`);
        setSaving(false);
        return;
      }

      await fetchPlayerAvailability(selectedPlayer, activeClubId);
      setSaving(false);
      alert("Availability saved for all upcoming matches!");
      return;
    }

    for (const match of matches) {
      const status = availabilityMap[match.match_id] || "maybe";
      const existingId = availabilityIdMap[match.match_id];

      if (existingId) {
        const { error } = await supabase
          .from(dataSource.availabilityTable)
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
          .from(dataSource.availabilityTable)
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
        <button onClick={() => navigate(buildClubPath("/"))} style={styles.backButton}>
          ← Back to Dashboard
        </button>

        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logoWrap}>
              {isLegacyEcc ? <img src={logo} alt={`${club.shortName} Logo`} style={styles.logo} /> : <span style={styles.logoText}>{club.shortName}</span>}
            </div>

            <div>
              <p style={styles.kicker}>{club.name}</p>
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
    padding: "12px",
    boxSizing: "border-box",
    overflowX: "hidden",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
    boxSizing: "border-box",
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
    flexWrap: "wrap",
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
    fontSize: "clamp(26px, 8vw, 34px)",
    lineHeight: "1.12",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    width: "100%",
  },
  searchInput: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
  },
  playerSelect: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
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
    padding: "14px",
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    alignItems: "center",
    boxSizing: "border-box",
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
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
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
    flexWrap: "wrap",
  },
};
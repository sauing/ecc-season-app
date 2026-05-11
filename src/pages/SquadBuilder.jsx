import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClub } from "../hooks/useClub";
import { supabase } from "../supabaseClient";

const HTCECA_VOLUNTEERS = [
  "Sridhar",
  "Siddhart",
  "Karthika",
  "Vidyanath",
  "Arjun",
  "Dhyan",
  "Shivansh",
  "Aayush",
  "Shameek",
  "Ilankathir",
  "Krishiv",
  "Ranjith",
  "Vivaan",
  "Sai Rakesh",
  "Krithick",
  "Ritwik",
  "Pranav",
  "Sumedh",
  "Suvan",
  "Partha",
  "Sankeerth",
  "Atharva",
  "Vinuthan",
  "Jaisoorya",
  "Shreyas",
  "Rishi",
  "Pruthvi",
  "Gracen",
  "Karson",
  "Shrujan",
  "Aryan",
  "Arman",
  "Vishnu",
  "Suchith",
  "Saiyam",
  "Siddhant",
  "Abyann",
  "Neel",
];


export default function SquadBuilder() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { clubSlug, club, buildClubPath, dataSource, isLegacyEcc } = useClub();

  const SQUAD_LIMIT = 12;

  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("available");
  const [teamFilter, setTeamFilter] = useState("all");
  const [duties, setDuties] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [matchId]);

  const dutyList = useMemo(() => {
    if (!isLegacyEcc) {
      return [
        "Aligning with Opponents",
        "Umpiring",
        "Scoring",
        "Arranging Food for Opponent Team",
        "Ground Setup & Cleaning Incharge",
      ];
    }

    const isHome = match?.home_away?.toLowerCase() === "home";

    return isHome
      ? ["Lunch", "Drinks", "Ground Setup", "Key Incharge", "Frogbox Setup"]
      : ["Kit Incharge", "Travel and Expense Planner"];
  }, [match, isLegacyEcc]);

  async function fetchData() {
    setLoading(true);

    let matchQuery = supabase
      .from(dataSource.dashboardView)
      .select("*")
      .eq("match_id", matchId);

    if (!isLegacyEcc) {
      matchQuery = matchQuery.eq("club_slug", clubSlug);
    }

    const { data: matchData, error: matchError } = await matchQuery.single();

    if (matchError) {
      console.error(matchError);
      alert("Could not load match");
      setLoading(false);
      return;
    }

    setMatch(matchData);

    const { data: availabilityData, error: availabilityError } = await supabase
      .from(dataSource.availabilityView)
      .select("*")
      .eq("match_id", matchId)
      .order("player_team", { ascending: true })
      .order("full_name", { ascending: true });

    if (availabilityError) {
      console.error(availabilityError);
      alert("Could not load players");
      setLoading(false);
      return;
    }

    let pickedQuery = supabase
      .from(dataSource.pickedPlayersView)
      .select("*")
      .eq("match_date", matchData.match_date);

    if (!isLegacyEcc) {
      pickedQuery = pickedQuery.eq("club_slug", clubSlug);
    }

    const { data: pickedData } = await pickedQuery;

    const pickedMap = {};
    (pickedData || []).forEach((p) => {
      if (p.match_id !== matchId) {
        pickedMap[p.player_id] = p.picked_for_team;
      }
    });

    const formatted = (availabilityData || []).map((x) => ({
      player_id: x.player_id,
      full_name: x.full_name,
      player_team: x.player_team || "Unknown",
      status: x.status,
      picked_for_team: pickedMap[x.player_id] || null,
    }));

    setPlayers(formatted);

    await loadExistingSquad();
    await loadExistingDuties();

    setLoading(false);
  }

  async function loadExistingSquad() {
    const { data: squad } = await supabase
      .from(dataSource.squadsTable)
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();

    if (!squad) return;

    const { data: squadPlayers } = await supabase
      .from(dataSource.squadPlayersTable)
      .select("player_id")
      .eq("squad_id", squad.id)
      .order("batting_position", { ascending: true });

    setSelectedPlayers((squadPlayers || []).map((p) => p.player_id));
  }

  async function loadExistingDuties() {
    const { data, error } = await supabase
      .from(dataSource.dutiesTable)
      .select("*")
      .eq("match_id", matchId);

    if (error) {
      console.error("Could not load duties:", error);
      return;
    }

    const dutyMap = {};
    (data || []).forEach((duty) => {
      dutyMap[duty.duty_type] = isLegacyEcc ? duty.player_id : duty.duty_note;
    });

    setDuties(dutyMap);
  }

  function togglePlayer(player) {
    if (player.picked_for_team) {
      alert(`${player.full_name} is already picked for ${player.picked_for_team}`);
      return;
    }

    if (selectedPlayers.includes(player.player_id)) {
      const updatedSelectedPlayers = selectedPlayers.filter(
        (id) => id !== player.player_id
      );

      setSelectedPlayers(updatedSelectedPlayers);

      const updatedDuties = { ...duties };

      if (isLegacyEcc) {
        Object.keys(updatedDuties).forEach((dutyName) => {
          if (updatedDuties[dutyName] === player.player_id) {
            updatedDuties[dutyName] = "";
          }
        });
      }

      setDuties(updatedDuties);
      return;
    }

    if (selectedPlayers.length >= SQUAD_LIMIT) {
      alert(`Squad limit is ${SQUAD_LIMIT} players including 12th man`);
      return;
    }

    setSelectedPlayers([...selectedPlayers, player.player_id]);
  }

  function handleDutyChange(dutyName, playerId) {
    setDuties((prev) => ({
      ...prev,
      [dutyName]: playerId,
    }));
  }

  async function saveSquad() {
    if (saving) return;

    setSaving(true);

    try {
    const pickedConflict = players.find(
      (p) => selectedPlayers.includes(p.player_id) && p.picked_for_team
    );

    if (pickedConflict) {
      alert(
        `${pickedConflict.full_name} is already picked for ${pickedConflict.picked_for_team}`
      );
      return;
    }

    const { data: rawMatch } = await supabase
      .from(dataSource.matchesTable)
      .select("team_id, club_id")
      .eq("id", matchId)
      .single();

    if (!rawMatch?.team_id) {
      alert("Team not found");
      return;
    }

    const resolvedClubId = rawMatch.club_id || match?.club_id;

    if (!isLegacyEcc && !resolvedClubId) {
      alert("Club not found for this match");
      return;
    }

    let squadId;

    const { data: existingSquad } = await supabase
      .from(dataSource.squadsTable)
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();

    if (existingSquad) {
      squadId = existingSquad.id;
    } else {
      const { data: newSquad, error } = await supabase
        .from(dataSource.squadsTable)
        .insert({
          match_id: matchId,
          team_id: rawMatch.team_id,
          status: "draft",
          ...(!isLegacyEcc ? { club_id: resolvedClubId } : {}),
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert("Could not create squad");
        return;
      }

      squadId = newSquad.id;
    }

    await supabase
      .from(dataSource.squadPlayersTable)
      .delete()
      .eq("squad_id", squadId);

    const rows = selectedPlayers.map((playerId, index) => ({
      squad_id: squadId,
      player_id: playerId,
      selection_type: index < 11 ? "playing_11" : "reserve",
      batting_position: index + 1,
      ...(!isLegacyEcc ? { club_id: resolvedClubId } : {}),
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from(dataSource.squadPlayersTable)
        .insert(rows);

      if (error) {
        console.error(error);
        alert("Could not save squad");
        return;
      }
    }

    const { error: dutyDeleteError } = await supabase
      .from(dataSource.dutiesTable)
      .delete()
      .eq("match_id", matchId);

    if (dutyDeleteError) {
      console.error(dutyDeleteError);
      alert("Squad saved, but old duties could not be cleared");
      return;
    }

    const dutyRows = Object.entries(duties)
      .filter(([_, assignee]) => assignee)
      .map(([dutyType, assignee]) => {
        if (isLegacyEcc) {
          return {
            match_id: matchId,
            player_id: assignee,
            duty_type: dutyType,
          };
        }

        return {
          match_id: matchId,
          duty_type: dutyType,
          duty_note: assignee,
          club_id: resolvedClubId,
        };
      });

    if (dutyRows.length > 0) {
      const { error: dutyInsertError } = await supabase
        .from(dataSource.dutiesTable)
        .insert(dutyRows);

      if (dutyInsertError) {
        console.error(dutyInsertError);
        alert(`Squad saved, but duties could not be saved: ${dutyInsertError.message}`);
        return;
      }
    }

    alert("Squad and duties saved successfully!");
    } finally {
      setSaving(false);
    }
  }

  function getPlayerName(playerId) {
    return players.find((p) => p.player_id === playerId)?.full_name || "";
  }

  function getDutyAssigneeName(assignee) {
    return isLegacyEcc ? getPlayerName(assignee) : assignee;
  }

  function copyWhatsAppMessage() {
    const selected = selectedPlayers
      .map((playerId) => players.find((p) => p.player_id === playerId))
      .filter(Boolean);

    const names = selected
      .map((p, index) => {
        const label = index === 11 ? "12th Man" : `${index + 1}`;
        return `${label}. ${p.full_name}`;
      })
      .join("\n");

    const dutyLines = dutyList
      .map((dutyName) => {
        const assignee = duties[dutyName];
        if (!assignee) return `${dutyName}: Not assigned`;
        return `${dutyName}: ${getDutyAssigneeName(assignee)}`;
      })
      .join("\n");

    const message = `🏏 ${club.shortName} Squad Announcement

${match.team} vs ${match.opponent}
📅 ${match.match_date}
⏰ ${match.start_time}
📍 ${match.venue}

Selected Squad:
${names}

Match Duties:
${dutyLines}

Please be on time.`;

    navigator.clipboard.writeText(message);
    alert("WhatsApp squad copied!");
  }

  const teams = ["all", ...new Set(players.map((p) => p.player_team))];

  const selectedSquadPlayers = selectedPlayers
    .map((playerId) => players.find((p) => p.player_id === playerId))
    .filter(Boolean);

  const filteredPlayers = players.filter((p) => {
    const statusOk = statusFilter === "all" || p.status === statusFilter;
    const teamOk = teamFilter === "all" || p.player_team === teamFilter;
    return statusOk && teamOk;
  });

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading squad builder...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1100px", margin: "auto" }}>
      <button onClick={() => navigate(buildClubPath("/"))} style={{ marginBottom: "16px" }}>
        ← Back
      </button>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "18px",
          marginBottom: "16px",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "24px" }}>
          Build Squad: {match.team} vs {match.opponent}
        </h1>

        <p style={{ margin: "8px 0", color: "#555" }}>
          {match.match_date} | {match.start_time} |{" "}
          {match.home_away?.toUpperCase()} | {match.venue}
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              fontWeight: "bold",
              padding: "8px 12px",
              borderRadius: "8px",
              background:
                selectedPlayers.length === SQUAD_LIMIT ? "#dcfce7" : "#fff7ed",
              border: "1px solid #ddd",
            }}
          >
            Selected: {selectedPlayers.length}/{SQUAD_LIMIT}
          </div>

          <button onClick={saveSquad}>💾 Save Squad + Duties</button>
          <button onClick={copyWhatsAppMessage}>📋 Copy WhatsApp Squad</button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "18px",
          marginBottom: "16px",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ margin: "0 0 8px" }}>Match Duties</h2>

        <p style={{ margin: "0 0 14px", color: "#555" }}>
          {isLegacyEcc
            ? match.home_away?.toLowerCase() === "home"
              ? "Home match duties"
              : "Away match duties"
            : "Youth match duties"}{" "}
          — {isLegacyEcc ? "one player can have multiple duties." : "assign duties to volunteers."}
        </p>

        {isLegacyEcc && selectedSquadPlayers.length === 0 ? (
          <div
            style={{
              padding: "12px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "8px",
              color: "#9a3412",
              fontWeight: "bold",
            }}
          >
            Select squad players first, then assign duties.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {dutyList.map((dutyName) => {
              const dutyOptions = isLegacyEcc
                ? selectedSquadPlayers.map((p) => ({
                    value: p.player_id,
                    label: p.full_name,
                  }))
                : HTCECA_VOLUNTEERS.map((name) => ({
                    value: name,
                    label: name,
                  }));

              return (
                <div
                  key={dutyName}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <label style={{ fontWeight: "bold" }}>{dutyName}</label>

                  <select
                    value={duties[dutyName] || ""}
                    onChange={(e) => handleDutyChange(dutyName, e.target.value)}
                    style={{
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                    }}
                  >
                    <option value="">Not assigned</option>
                    {dutyOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="available">Available only</option>
          <option value="maybe">Maybe only</option>
          <option value="unavailable">Unavailable only</option>
        </select>

        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team === "all" ? "All Teams" : team}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {filteredPlayers.map((p) => {
          const selected = selectedPlayers.includes(p.player_id);
          const disabled = !!p.picked_for_team;

          return (
            <label
              key={p.player_id}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 100px 150px",
                alignItems: "center",
                gap: "10px",
                border: selected ? "2px solid #16a34a" : "1px solid #ddd",
                borderRadius: "10px",
                padding: "12px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                background: disabled
                  ? "#e5e7eb"
                  : selected
                  ? "#dcfce7"
                  : p.status === "available"
                  ? "#ecfdf5"
                  : p.status === "unavailable"
                  ? "#fef2f2"
                  : "#fffbeb",
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => togglePlayer(p)}
                style={{ width: "20px", height: "20px" }}
              />

              <div>
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                  {p.full_name}
                </div>
                {disabled && (
                  <div style={{ color: "#b91c1c", fontSize: "13px" }}>
                    Already picked by {p.picked_for_team}
                  </div>
                )}
              </div>

              <div style={{ fontWeight: "bold", textAlign: "center" }}>
                {p.player_team}
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: "5px 8px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  background:
                    p.status === "available"
                      ? "#bbf7d0"
                      : p.status === "unavailable"
                      ? "#fecaca"
                      : "#fde68a",
                }}
              >
                {p.status}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
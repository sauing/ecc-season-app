import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const DIVISIONS = [
  { key: "HK", label: "HK", fullName: "Hoofdklasse" },
  { key: "OV", label: "OV", fullName: "2EK Serie A" },
  { key: "FOUR_E", label: "4E", fullName: "4EK Serie E" },
];

const STAT_TYPES = [
  { key: "batting", label: "Batting" },
  { key: "bowling", label: "Bowling" },
  { key: "fielding", label: "Fielding" },
];

const COLUMN_LABELS = {
  matches: "M",
  innings: "I",
  notOut: "NO",
  runs: "R",
  highScore: "HS",
  average: "AVG",
  strikeRate: "SR",
  hundreds: "100",
  fifties: "50",
  sixes: "6S",
  fours: "4S",
  overs: "O",
  maidens: "M",
  wickets: "W",
  best: "BB",
  economy: "ECON",
  fourWickets: "4W",
  fiveWickets: "5W",
  catches: "C",
  runOutAssisted: "RO-A",
  runOutUnassisted: "RO-U",
  wicketKeeperCatches: "WK-C",
  stumpings: "ST",
  dismissals: "DIS",
};

const COLUMNS_BY_TYPE = {
  batting: [
    "matches",
    "innings",
    "notOut",
    "runs",
    "average",
    "highScore",
    "strikeRate",
    "hundreds",
    "fifties",
    "sixes",
    "fours",
  ],
  bowling: [
    "matches",
    "overs",
    "maidens",
    "runs",
    "wickets",
    "average",
    "economy",
    "best",
    "strikeRate",
    "fourWickets",
    "fiveWickets",
  ],
  fielding: [
    "matches",
    "catches",
    "runOutAssisted",
    "runOutUnassisted",
    "wicketKeeperCatches",
    "stumpings",
    "dismissals",
  ],
};

function valueOf(row, key) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? "-" : value;
}

function hasValue(row, key) {
  const value = row?.[key];
  return value !== undefined && value !== null && value !== "";
}

function getMainColumn(type) {
  if (type === "batting") return "runs";
  if (type === "bowling") return "wickets";
  return "catches";
}

async function readPayload(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `API returned non-JSON. Status ${response.status}. First response text: ${text.slice(0, 250)}`
    );
  }
}

export default function KncbStats() {
  const navigate = useNavigate();

  const [division, setDivision] = useState("HK");
  const [type, setType] = useState("batting");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const selectedDivision = useMemo(
    () => DIVISIONS.find((item) => item.key === division) || DIVISIONS[0],
    [division]
  );

  const selectedStat = useMemo(
    () => STAT_TYPES.find((item) => item.key === type) || STAT_TYPES[0],
    [type]
  );

  const visibleColumns = useMemo(() => {
    const preferred = COLUMNS_BY_TYPE[type] || [];
    return preferred.filter((column) => rows.some((row) => hasValue(row, column)));
  }, [rows, type]);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [division, type]);

  async function loadStats() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/kncb-stats?grade=${encodeURIComponent(division)}&type=${encodeURIComponent(type)}`
      );

      const payload = await readPayload(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not load KNCB stats.");
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setLastUpdated(payload.fetchedAt || "");
    } catch (err) {
      console.error("KNCB stats error:", err);
      setRows([]);
      setError(err.message || "Could not load KNCB stats.");
    } finally {
      setLoading(false);
    }
  }

  const mainColumn = getMainColumn(type);

  return (
    <div className="kncb-page">
      <style>{css}</style>

      <div className="kncb-container">
        <button className="back-button" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>

        <header className="hero-card">
          <div>
            <p className="kicker">Eindhoven Cricket Club</p>
            <h1>KNCB Stats</h1>
            <p className="subtitle">
              Live KNCB statistics filtered to only Eindhoven CC players.
            </p>
          </div>

          <button className="refresh-button" onClick={loadStats} disabled={loading}>
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
        </header>

        <section className="controls-card">
          <div>
            <h2>Select Division</h2>
            <div className="tab-grid">
              {DIVISIONS.map((item) => (
                <button
                  key={item.key}
                  className={division === item.key ? "tab active-tab" : "tab"}
                  onClick={() => setDivision(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2>Select Stats</h2>
            <div className="tab-grid">
              {STAT_TYPES.map((item) => (
                <button
                  key={item.key}
                  className={type === item.key ? "tab active-tab" : "tab"}
                  onClick={() => setType(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="summary-card">
          <div>
            <p className="kicker">{selectedDivision.fullName}</p>
            <h2>
              {selectedDivision.label} • {selectedStat.label}
            </h2>
            <p className="small-text">
              {rows.length} Eindhoven CC player records found
              {lastUpdated ? ` • Updated ${new Date(lastUpdated).toLocaleString()}` : ""}
            </p>
          </div>

          <span className="live-badge">Live KNCB Source</span>
        </section>

        {error ? (
          <div className="error-card">
            <h3>Could not load stats</h3>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="message-card">Loading KNCB stats...</div>
        ) : rows.length === 0 ? (
          <div className="message-card">No Eindhoven CC records found for this selection.</div>
        ) : (
          <section className="stats-card">
            <div className="mobile-list">
              {rows.map((row, index) => (
                <article className="player-card" key={`${row.rank}-${row.player}-${index}`}>
                  <div className="player-card-top">
                    <div>
                      <p className="rank">#{row.rank}</p>
                      <h3>{row.player}</h3>
                      <p>{row.club}</p>
                    </div>

                    <div className="main-stat">
                      <span>{COLUMN_LABELS[mainColumn] || mainColumn}</span>
                      <strong>{valueOf(row, mainColumn)}</strong>
                    </div>
                  </div>

                  <div className="stat-grid">
                    {visibleColumns.map((column) => (
                      <div className="stat-box" key={column}>
                        <span>{COLUMN_LABELS[column] || column}</span>
                        <strong>{valueOf(row, column)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Club</th>
                    {visibleColumns.map((column) => (
                      <th key={column}>{COLUMN_LABELS[column] || column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.rank}-${row.player}-${index}`}>
                      <td>{row.rank}</td>
                      <td className="player-name">{row.player}</td>
                      <td>{row.club}</td>
                      {visibleColumns.map((column) => (
                        <td key={column}>{valueOf(row, column)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const css = `
  .kncb-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ecfdf5 100%);
    padding: 10px;
    box-sizing: border-box;
    overflow-x: hidden;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .kncb-container {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  .back-button {
    background: #ffffff;
    color: #0f172a;
    border: 1px solid #dbe4f0;
    padding: 10px 12px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    margin-bottom: 10px;
    box-shadow: 0 8px 18px rgba(15,23,42,0.08);
  }

  .hero-card,
  .controls-card,
  .summary-card,
  .stats-card,
  .message-card,
  .error-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    box-shadow: 0 8px 18px rgba(15,23,42,0.06);
    margin-bottom: 12px;
  }

  .hero-card {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .kicker {
    margin: 0;
    color: #2563eb;
    font-weight: 900;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h1 {
    margin: 4px 0;
    font-size: clamp(28px, 8vw, 44px);
    line-height: 1.05;
    color: #0f172a;
    font-weight: 900;
  }

  .subtitle,
  .small-text {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
  }

  .refresh-button {
    background: #16a34a;
    color: white;
    border: none;
    padding: 11px 14px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    font-size: 13px;
    box-shadow: 0 8px 18px rgba(22,163,74,0.20);
  }

  .controls-card {
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .controls-card h2 {
    margin: 0 0 8px;
    color: #0f172a;
    font-size: 15px;
  }

  .tab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(95px, 1fr));
    gap: 8px;
  }

  .tab {
    background: #f8fafc;
    color: #334155;
    border: 1px solid #dbe4f0;
    padding: 10px 8px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 900;
    font-size: 12px;
  }

  .active-tab {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
    box-shadow: 0 8px 16px rgba(37,99,235,0.25);
  }

  .summary-card {
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .summary-card h2 {
    margin: 4px 0;
    color: #0f172a;
    font-size: 18px;
  }

  .live-badge {
    background: #dcfce7;
    color: #166534;
    padding: 8px 10px;
    border-radius: 999px;
    font-weight: 900;
    font-size: 11px;
  }

  .message-card,
  .error-card {
    padding: 18px;
  }

  .message-card {
    text-align: center;
    color: #64748b;
    font-weight: 800;
  }

  .error-card {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #9f1239;
  }

  .stats-card {
    overflow: hidden;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th {
    background: #f97316;
    color: white;
    padding: 11px 9px;
    font-size: 12px;
    text-align: left;
    white-space: nowrap;
  }

  td {
    padding: 10px 9px;
    color: #334155;
    font-size: 13px;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .player-name {
    color: #0f172a;
    font-weight: 900;
    min-width: 210px;
  }

  .mobile-list {
    display: none;
  }

  .player-card {
    padding: 12px;
    border-bottom: 1px solid #e2e8f0;
  }

  .player-card-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .rank {
    margin: 0;
    color: #64748b;
    font-weight: 900;
    font-size: 12px;
  }

  .player-card h3 {
    margin: 3px 0;
    color: #0f172a;
    font-size: 16px;
  }

  .player-card p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .main-stat {
    background: #ecfdf5;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 8px 12px;
    min-width: 62px;
    text-align: center;
  }

  .main-stat span,
  .stat-box span {
    color: #64748b;
    font-size: 10px;
    font-weight: 900;
  }

  .main-stat strong {
    display: block;
    color: #14532d;
    font-size: 18px;
    font-weight: 900;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
    margin-top: 10px;
  }

  .stat-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 7px;
    text-align: center;
  }

  .stat-box strong {
    display: block;
    color: #0f172a;
    font-size: 13px;
    font-weight: 900;
  }

  @media (max-width: 640px) {
    .kncb-page {
      padding: 8px;
    }

    .hero-card {
      padding: 14px;
    }

    .refresh-button {
      width: 100%;
    }

    .controls-card {
      grid-template-columns: 1fr;
    }

    .table-wrap {
      display: none;
    }

    .mobile-list {
      display: block;
    }

    .stat-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
`;

import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";

const STAT_URLS = {
  HK: {
    label: "Hoofdklasse",
    batting:
      "https://matchcentre.kncb.nl/statistics/batting?entity=134453&grade=71375&season=21",
    bowling:
      "https://matchcentre.kncb.nl/statistics/bowling?entity=134453&grade=71375&season=21",
    fielding:
      "https://matchcentre.kncb.nl/statistics/fielding?entity=134453&grade=71375&season=21",
  },
  OV: {
    label: "2EK / OV",
    batting:
      "https://matchcentre.kncb.nl/statistics/batting?entity=134453&grade=73940&season=21",
    bowling:
      "https://matchcentre.kncb.nl/statistics/bowling?entity=134453&grade=73940&season=21",
    fielding:
      "https://matchcentre.kncb.nl/statistics/fielding?entity=134453&grade=73940&season=21",
  },
  FOUR_E: {
    label: "4E",
    batting:
      "https://matchcentre.kncb.nl/statistics/batting?entity=134453&grade=73942&season=21",
    bowling:
      "https://matchcentre.kncb.nl/statistics/bowling?entity=134453&grade=73942&season=21",
    fielding:
      "https://matchcentre.kncb.nl/statistics/fielding?entity=134453&grade=73942&season=21&team=136540",
  },
};

const HEADERS = {
  batting: [
    "rank",
    "player",
    "club",
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
    "rank",
    "player",
    "club",
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
    "rank",
    "player",
    "club",
    "matches",
    "catches",
    "runOutAssisted",
    "runOutUnassisted",
    "wicketKeeperCatches",
    "stumpings",
    "dismissals",
  ],
};

function normalizeLine(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isRank(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function isLikelyPlayerName(value = "") {
  const text = String(value || "").trim();

  if (!text) return false;
  if (isRank(text)) return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return false;
  if (text === "-") return false;
  if (["Batting", "Bowling", "Fielding", "PLAYER", "Select club..."].includes(text)) {
    return false;
  }

  return /[A-Za-zÀ-ÿ]/.test(text);
}

function isEindhovenClub(value = "") {
  const text = String(value || "").toLowerCase().trim();

  return (
    text === "eindhoven cc" ||
    text.includes("eindhoven cc") ||
    text.includes("eindhoven cricket club")
  );
}

function isStartOfPlayerRow(lines, index) {
  return (
    isRank(lines[index]) &&
    isLikelyPlayerName(lines[index + 1]) &&
    isLikelyPlayerName(lines[index + 2])
  );
}

function mapRow(type, row) {
  const headers = HEADERS[type] || HEADERS.batting;
  const mapped = {};

  row.forEach((value, index) => {
    mapped[headers[index] || `extra_${index - headers.length + 1}`] = value;
  });

  mapped.raw = row;
  return mapped;
}

function parseStatsText(pageText, type) {
  const lines = String(pageText)
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const allPlayerRows = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!isStartOfPlayerRow(lines, i)) continue;

    let nextRowIndex = lines.length;

    for (let j = i + 3; j < lines.length; j += 1) {
      if (isStartOfPlayerRow(lines, j)) {
        nextRowIndex = j;
        break;
      }
    }

    const rawRow = lines.slice(i, nextRowIndex);

    if (rawRow.length >= 4 && rawRow.length <= 30) {
      allPlayerRows.push(rawRow);
    }

    i = nextRowIndex - 1;
  }

  const rows = allPlayerRows
    .filter((row) => isEindhovenClub(row[2]))
    .map((row) => mapRow(type, row));

  return {
    rows,
    debug: {
      lineCount: lines.length,
      firstParsedRows: allPlayerRows.slice(0, 5),
      firstEindhovenRows: rows.slice(0, 5),
    },
  };
}

function isLocalEnvironment() {
  return process.env.VERCEL !== "1";
}

async function getBrowser() {
  if (isLocalEnvironment()) {
    return puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  return puppeteerCore.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

export default async function handler(req, res) {
  let browser;

  try {
    const grade = String(req.query.grade || "HK");
    const type = String(req.query.type || "batting");

    const gradeConfig = STAT_URLS[grade];

    if (!gradeConfig) {
      return res.status(400).json({
        ok: false,
        error: `Invalid grade: ${grade}`,
      });
    }

    if (!gradeConfig[type]) {
      return res.status(400).json({
        ok: false,
        error: `Invalid stats type: ${type}`,
      });
    }

    browser = await getBrowser();

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(gradeConfig[type], {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page
      .waitForFunction(
        () => {
          const bodyText = document.body?.innerText || "";
          return bodyText.includes("Eindhoven CC") || bodyText.includes("PLAYER");
        },
        { timeout: 45000 }
      )
      .catch(() => null);

    const pageText = await page.evaluate(() => document.body.innerText || "");
    const parsed = parseStatsText(pageText, type);

    return res.status(200).json({
      ok: true,
      grade,
      gradeLabel: gradeConfig.label,
      type,
      sourceUrl: gradeConfig[type],
      count: parsed.rows.length,
      rows: parsed.rows,
      debug: parsed.debug,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch KNCB stats",
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

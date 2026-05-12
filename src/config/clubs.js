export const DEFAULT_CLUB_SLUG =
  import.meta.env.VITE_DEFAULT_CLUB_SLUG || "ecc";

export const CLUBS = {
  ecc: {
    slug: "ecc",
    name: "Eindhoven Cricket Club",
    shortName: "ECC",
    seasonTitle: "ECC Season 2026",
    mode: "legacy_ecc",
  },
  htceca: {
    slug: "htceca",
    name: "HTCECA",
    shortName: "HTCECA",
    seasonTitle: "HTCECA Season 2026",
    mode: "generic_club",
  },
};

export function getClubConfig(clubSlug) {
  const normalizedSlug = String(clubSlug || DEFAULT_CLUB_SLUG).toLowerCase();

  return CLUBS[normalizedSlug] || {
    slug: normalizedSlug,
    name: normalizedSlug.toUpperCase(),
    shortName: normalizedSlug.toUpperCase(),
    seasonTitle: `${normalizedSlug.toUpperCase()} Season 2026`,
    mode: "generic_club",
  };
}

export function isLegacyEccClub(clubSlug) {
  return getClubConfig(clubSlug).mode === "legacy_ecc";
}

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DEFAULT_CLUB_SLUG, getClubConfig } from "../config/clubs";
import { getClubDataSource } from "../config/clubDataSource";

export function useClub() {
  const params = useParams();

  const clubSlug = String(params.clubSlug || DEFAULT_CLUB_SLUG).toLowerCase();

  const club = useMemo(() => getClubConfig(clubSlug), [clubSlug]);
  const dataSource = useMemo(() => getClubDataSource(clubSlug), [clubSlug]);

  function buildClubPath(path = "") {
    const cleanPath = String(path || "").trim();

    if (!cleanPath || cleanPath === "/") {
      return `/${clubSlug}`;
    }

    return `/${clubSlug}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
  }

  return {
    clubSlug,
    club,
    dataSource,
    isLegacyEcc: club.mode === "legacy_ecc",
    buildClubPath,
  };
}

import { isLegacyEccClub } from "./clubs";

export function getClubDataSource(clubSlug) {
  if (isLegacyEccClub(clubSlug)) {
    return {
      mode: "legacy_ecc",
      accessCodesTable: "ecc_season_access_codes",
      dashboardView: "ecc_season_match_dashboard",
      availabilityView: "ecc_season_match_availability_view",
      availabilityTable: "ecc_season_match_availability",
      playersTable: "ecc_season_players",
      matchesTable: "ecc_season_matches",
      pickedPlayersView: "ecc_season_picked_players_view",
      squadsTable: "ecc_season_match_squads",
      squadPlayersTable: "ecc_season_match_squad_players",
      dutiesTable: "ecc_season_match_duties",
    };
  }

  return {
    mode: "generic_club",
    accessCodesTable: "club_season_access_codes",
    dashboardView: "club_season_match_dashboard",
    availabilityView: "club_season_match_availability_view",
    availabilityTable: "club_season_match_availability",
    playersTable: "club_season_players",
    matchesTable: "club_season_matches",
    pickedPlayersView: "club_season_picked_players_view",
    squadsTable: "club_season_match_squads",
    squadPlayersTable: "club_season_match_squad_players",
    dutiesTable: "club_season_match_duties",
  };
}

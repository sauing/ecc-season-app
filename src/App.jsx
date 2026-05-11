import { BrowserRouter, Routes, Route } from "react-router-dom";
import SeasonDashboard from "./pages/SeasonDashboard";
import MatchAvailability from "./pages/MatchAvailability";
import SquadBuilder from "./pages/SquadBuilder";
import SeasonLogin from "./pages/SeasonLogin";
import MultiMatchAvailability from "./pages/MultiMatchAvailability";
import FantasyPoints from "./pages/FantasyPoints";
import KncbStats from "./pages/KncbStats";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing ECC routes kept for safety */}
        <Route path="/" element={<SeasonDashboard />} />
        <Route path="/login" element={<SeasonLogin />} />
        <Route path="/match/:matchId" element={<MatchAvailability />} />
        <Route path="/match/:matchId/squad" element={<SquadBuilder />} />
        <Route path="/availability/multiple" element={<MultiMatchAvailability />} />

        {/* Fantasy/KNCB stay ECC-only for now */}
        <Route path="/fantasy-points" element={<FantasyPoints />} />
        <Route path="/kncb-stats" element={<KncbStats />} />

        {/* New club-aware season routes */}
        <Route path="/:clubSlug" element={<SeasonDashboard />} />
        <Route path="/:clubSlug/login" element={<SeasonLogin />} />
        <Route path="/:clubSlug/match/:matchId" element={<MatchAvailability />} />
        <Route path="/:clubSlug/match/:matchId/squad" element={<SquadBuilder />} />
        <Route
          path="/:clubSlug/availability/multiple"
          element={<MultiMatchAvailability />}
        />
      </Routes>
    </BrowserRouter>
  );
}

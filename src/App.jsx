import { BrowserRouter, Routes, Route } from "react-router-dom";
import SeasonDashboard from "./pages/SeasonDashboard";
import MatchAvailability from "./pages/MatchAvailability";
import SquadBuilder from "./pages/SquadBuilder";
import SeasonLogin from "./pages/SeasonLogin";
import MultiMatchAvailability from "./pages/MultiMatchAvailability";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SeasonDashboard />} />
        <Route path="/login" element={<SeasonLogin />} />
        <Route path="/match/:matchId" element={<MatchAvailability />} />
        <Route path="/match/:matchId/squad" element={<SquadBuilder />} />
        <Route path="/availability/multiple" element={<MultiMatchAvailability />} />
      </Routes>
    </BrowserRouter>
  );
}
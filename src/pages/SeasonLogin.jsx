import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function SeasonLogin() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    const cleanCode = code.trim();

    if (!cleanCode) {
      alert("Please enter login code");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("ecc_season_access_codes")
      .select("*")
      .eq("code", cleanCode.toUpperCase())
      .eq("is_active", true)
      .single();

    setLoading(false);

    if (error || !data) {
      alert("Invalid or inactive code");
      return;
    }

    const session = {
      role: data.role,
      team: data.team,
      personName: data.person_name,
      loginTime: new Date().toISOString(),
    };

    localStorage.setItem("ecc_season_session", JSON.stringify(session));

    navigate("/");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "24px" }}>
      <div
        style={{
          maxWidth: "420px",
          margin: "80px auto",
          background: "white",
          padding: "24px",
          borderRadius: "14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "6px" }}>
          Captain / Admin Login
        </h1>

        <p style={{ color: "#666", marginBottom: "22px" }}>
          Enter your ECC team code to manage squads.
        </p>

        <form onSubmit={handleLogin}>
          <label style={{ fontWeight: "600", display: "block", marginBottom: "8px" }}>
            Login Code
          </label>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter Login Code"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              marginBottom: "16px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "#111827",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "15px",
            }}
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%",
            marginTop: "12px",
            background: "#e5e7eb",
            color: "#111827",
            border: "none",
            padding: "12px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Back to Public Dashboard
        </button>
      </div>
    </div>
  );
}
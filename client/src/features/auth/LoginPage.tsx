import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { login } from "@/features/auth/api/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      queryClient.clear();
      navigate("/city");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 w-80 flex flex-col gap-4">
        <h1 className="text-center text-xl text-[#e6b800] tracking-widest">aSignOfWar</h1>
        <h2 className="text-center text-sm text-[#b1bac4] font-normal">Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="bg-[#0d1117] border border-[#30363d] rounded-md text-[#c9d1d9] text-sm px-3 py-2 focus:outline-none focus:border-[#58a6ff]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-[#0d1117] border border-[#30363d] rounded-md text-[#c9d1d9] text-sm px-3 py-2 focus:outline-none focus:border-[#58a6ff]"
          />
          {error && <p className="text-[#f85149] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-[#238636] text-white rounded-md text-sm py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
        <p className="text-center text-xs text-[#b1bac4]">
          No account? <Link to="/register" className="text-[#58a6ff]">Register</Link>
        </p>
      </div>
    </div>
  );
}

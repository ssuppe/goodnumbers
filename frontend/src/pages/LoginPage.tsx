import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    void fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken: string }) => setCsrfToken(data.csrfToken));
  }, []);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-lg shadow-sm border border-mesa-border">
      <h1 className="text-2xl font-bold text-center v3-primary-text mb-6">
        Log In
      </h1>

      <form
        action="/api/auth/callback/credentials"
        method="POST"
        className="space-y-4"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="action" value="login" />

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-mesa-muted mb-1"
          >
            Email Address
          </label>
          <input
            type="email"
            name="email"
            id="email"
            required
            className="w-full px-4 py-2 border border-mesa-border rounded-md focus:ring-2 focus:ring-mesa-primary focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-mesa-muted mb-1"
          >
            Password
          </label>
          <input
            type="password"
            name="password"
            id="password"
            required
            className="w-full px-4 py-2 border border-mesa-border rounded-md focus:ring-2 focus:ring-mesa-primary focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-mesa-primary text-white font-semibold py-2 px-4 rounded-md hover:bg-orange-700 transition-colors duration-200"
        >
          Sign In
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-mesa-muted">
        Don't have an account?{" "}
        <Link to="/register" className="text-mesa-primary hover:underline">
          Register here
        </Link>
      </p>
    </div>
  );
}

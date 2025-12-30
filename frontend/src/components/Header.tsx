import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-mesa-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        {/* Updated: Using Mesa Secondary (Petrol Blue) for the Brand Name via utility class */}
        <Link
          to="/"
          className="text-2xl font-bold v3-primary-text hover:opacity-80 transition-opacity"
        >
          GoodNumbers
        </Link>
        <nav>
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                to="/setup"
                className="text-sm font-medium text-mesa-muted hover:text-mesa-text transition-colors"
              >
                Settings
              </Link>
              <a
                href="/api/auth/signout"
                rel="noopener noreferrer"
                className="text-sm font-medium text-mesa-muted hover:text-mesa-text transition-colors"
              >
                Logout
              </a>
            </div>
          ) : (
            /* Updated: Using Mesa Primary (Terracotta) for the Login Action */
            <a
              href="/api/auth/signin"
              rel="noopener noreferrer"
              className="text-sm font-medium text-mesa-primary hover:text-orange-700 transition-colors"
            >
              Login / Register
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

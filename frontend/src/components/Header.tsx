import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold v3-primary-text">
          GoodNumbers
        </Link>
        <nav>
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/setup" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Settings
              </Link>
              <a href="/api/auth/signout" rel="noopener noreferrer" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                Logout
              </a>
            </div>
          ) : (
            <a href="/api/auth/signin" rel="noopener noreferrer" className="text-sm font-medium v3-primary-text hover:text-blue-700">
              Login / Register
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
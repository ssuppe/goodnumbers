// file: frontend/src/components/Layout.tsx
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Layout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  return (
    <div>
      <header style={{ borderBottom: '1px solid #ccc', padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/">
          <h1>Goodnumbers</h1>
        </Link>
        <nav>
          {user ? (
            <>
              <Link to="/settings" style={{ marginRight: '1rem' }}>Settings</Link>
              {/* This will be a real logout button later */}
              <a href="/api/auth/signout">Logout</a>
            </>
          ) : (
            <a href="/api/auth/signin">Login</a>
          )}
        </nav>
      </header>
      <main style={{ padding: '1rem' }}>
        <Outlet />
      </main>
      <footer style={{ borderTop: '1px solid #ccc', padding: '1rem', marginTop: '2rem' }}>
        <p>&copy; 2025 Goodnumbers. All rights reserved.</p>
      </footer>
    </div>
  );
}

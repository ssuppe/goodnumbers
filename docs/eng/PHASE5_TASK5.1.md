Of course. I've integrated all the recommended security and privacy enhancements directly into the design document.

I've made sure to keep the TDD workflow intact and have added explicit callouts and explanations for the changes, making the document even more detailed and instructive for a junior engineer. The core of the changes is to introduce a `ProtectedRoute` early and to ensure we never expose sensitive user data to the client-side global state.

Here is the complete, updated design document for Phase 5, Task 5.1.

---

# Goodnumbers — Phase 5, Task 5.1 (Revised for Security)

## TL;DR

Implement the main application layout, routing, a global authentication context to manage user session state, and foundational route protection. This includes dynamic header content and a global loading state.

## Invariants (do not change)

- The application must use `react-router-dom` for all client-side routing.
- User session state must be managed by a global `AuthContext` and sourced from the `/api/session` endpoint, which provides a **secure subset** of user data.
- All pages must be rendered within a shared `Layout` component that provides a consistent header and footer.
- All new components and logic must be covered by passing unit tests using Vitest and React Testing Library.

## Assumptions & Scope

- **Assumption:** The backend development server is running and the `/api/session` endpoint is available to provide the current user's authentication status.
- **Assumption:** Placeholder UI for the header, footer, and individual pages is sufficient. The focus is on structure, not visual polish.
- **Scope:** This task is limited to implementing the application's structural shell: routing, the layout component, the authentication context, and a **foundational `ProtectedRoute` component**. The scope explicitly includes making the header dynamic based on auth state and handling the initial global loading state.
- **Out of Scope:** This task does not include implementing the UI for the pages themselves (Dashboard, etc.), nor does it include the logic for performing login or logout actions.

## Objectives

1.  **Establish Routing:** Configure `react-router-dom` with routes for all primary application pages: `Home`, `Dashboard`, `Agreements`, and `Setup`.
2.  **Create Shared Layout:** Implement a `Layout.tsx` component that wraps all page-level content, provides a consistent header/footer, and dynamically updates its content based on the user's authentication status and the initial session loading state.
3.  **Implement Global Auth State:** Create and provide a global `AuthContext` that fetches a **secure, non-sensitive subset** of the user's session from `/api/session` on application load and makes the session data, loading, and error states available to all components.
4.  **Implement Route Protection:** Create a `ProtectedRoute.tsx` component that uses the `AuthContext` to prevent unauthenticated users from accessing protected client-side routes.
5.  **Validate Integration:** Ensure the `AuthProvider` is correctly wrapped around the application's root, and all protected routes render their placeholder components within the `Layout`, which correctly reflects the auth and loading states.

## Risks & Mitigations

- **Risk:** The `AuthContext` could trigger excessive re-renders across the application when its value changes.
  - **Mitigation:** The context's provider value will be memoized using `useMemo` to ensure its reference only changes when the underlying session data actually changes.
- **Risk:** Sensitive user data (like API tokens) could be exposed to the client-side application.
  - **Mitigation:** This risk is addressed directly in this task. The `/api/session` endpoint must be designed to only return non-sensitive data. The `AuthContext` will only ever store this "safe" user object, adhering to the Principle of Least Privilege.
- **Risk:** Logic for handling authenticated vs. unauthenticated routes could become scattered and difficult to maintain.
  - **Mitigation:** This risk is addressed directly in this task by creating a dedicated `ProtectedRoute` component to encapsulate all authentication checks for client-side routes.

## Security & Privacy Enhancements (Rationale for Changes)

This revised plan incorporates several key security and privacy improvements that are critical to establish at this foundational stage.

1.  **Preventing Sensitive Data Exposure (Critical):** The original plan implied fetching the entire `User` object into the global state. This is a significant risk, as the `User` model contains secrets like `rssToken` and `nightscoutToken`. **The Fix:** We will introduce a new, safe type called `SessionUser` that contains only the data needed for the UI (like `name` and `id`). The `AuthContext` will only ever hold this safe data. Sensitive information will never be sent to or stored in the browser's global state.

2.  **Implementing Immediate Route Protection:** Deferring route protection is a security risk. An unauthenticated user could access URLs for protected pages, and a future developer might mistakenly add UI that doesn't check for auth status. **The Fix:** We are adding the creation of a `ProtectedRoute` component to the scope of this task. This ensures our application shell is secure-by-default from the very beginning.

3.  **Secure Error Handling:** Storing raw `Error` objects in state can potentially leak internal application details. **The Fix:** The `AuthContext` will only store the error _message_ (`string | null`) rather than the entire error object, ensuring we only store and expose the minimum necessary information.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Create a scalable and maintainable foundation for the frontend application by separating routing, layout, and global state management concerns.
- **Mechanism:**
  1.  **Routing:** Use `react-router-dom`'s `createBrowserRouter`. A top-level layout route will render the `Layout.tsx` component. Protected child routes will be wrapped in a `ProtectedRoute` component.
  2.  **State Management:** Employ React's Context API for the `AuthContext`. The `AuthProvider` will fetch the session data.
  3.  **Component Structure:** The `App.tsx` will set up the `AuthProvider` and the `RouterProvider`. The `Layout.tsx` will consume the `AuthContext` to manage its state. `ProtectedRoute.tsx` will consume it to manage access.
- **Trade-offs:**
  - **Pro:** Using React Context is lightweight and avoids adding another third-party state management library for global auth state, which changes infrequently.
  - **Con:** React Context is not optimized for high-frequency updates, but this is not a concern for user session data.
- **Go/No-Go Decision:** **Go**. This is a foundational prerequisite for all subsequent UI development.

## Implementation Notes

- **API Client:** The `AuthContext` must use the centralized `axios` instance from `frontend/src/lib/api.ts`.
- **Context Value:** The `AuthContext` will provide `user: SessionUser | null`, `isLoading: boolean`, and `error: string | null`. The `SessionUser` type must only contain non-sensitive fields.
- **Layout Component:** The `Layout.tsx` will consume the `AuthContext`. It will render a global loading indicator if `isLoading` is true. Otherwise, it will render the header, `<Outlet />`, and footer, with the header's content changing based on whether a `user` is present.

## Acceptance Gates

1.  On initial application load, a global loading indicator is displayed until the `GET /api/session` request completes.
2.  The header displays a "Login" link for unauthenticated users and "Settings" / "Logout" placeholders for authenticated users.
3.  Navigating to `/` renders the `HomePage`.
4.  Navigating directly to `/dashboard` as an unauthenticated user redirects to a login page (or home page for now).
5.  Navigating to `/dashboard` as an authenticated user correctly renders the placeholder `DashboardPage` component inside the shared `Layout`.
6.  A single `GET` request to `/api/session` is made on application load.
7.  All new unit tests for `Layout.tsx`, `AuthContext.tsx`, `ProtectedRoute.tsx`, and page components must pass (`npm test -w frontend`).

---

## In-depth engineering plan

The engineering plan below follows a strict Test-Driven Development (TDD) approach. The tests serve as the primary definition of correctness.

### Step 1 (RED): Test the Authentication Context

Create the test file for the `AuthContext`. This test defines our security requirements: the context must handle a _safe_ `SessionUser` object (not the full Prisma type) and store errors as simple strings.

```typescript
// file: frontend/src/contexts/AuthContext.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider, useAuth, type SessionUser } from './AuthContext';
import { api } from '../lib/api';

vi.mock('../lib/api');

const TestConsumer = () => {
  const { user, isLoading, error } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>; // Now expects a string
  if (user) return <div>Welcome, {user.name}</div>;
  return <div>Logged out</div>;
};

describe('AuthProvider', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('provides user data on successful session fetch', async () => {
    // IMPORTANT: This mock only contains non-sensitive data.
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    vi.mocked(api.get).mockResolvedValue({ data: { user: mockUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
    });
  });

  it('provides null user when session is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
    });
  });

  it('provides an error message string on failed fetch', async () => {
    const errorMessage = 'Network Error';
    vi.mocked(api.get).mockRejectedValue(new Error(errorMessage));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      // The component should render the error message directly as a string.
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
    });
  });
});
```

### Step 2 (GREEN): Implement the Authentication Context

Create the `AuthContext.tsx` file. This implementation must satisfy the security requirements defined in the test: use a `SessionUser` type and store errors as strings.

```typescript
// file: frontend/src/contexts/AuthContext.tsx
import {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';

// This is the SAFE user type. It includes only what the UI needs
// and explicitly omits sensitive tokens.
export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null; // Error is now a string for security
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      try {
        // Define the expected response shape, using the safe SessionUser type.
        const response = await api.get<{ user: SessionUser } | null>('/session');
        setUser(response.data?.user ?? null);
      } catch (err) {
        // Store only the message, not the entire error object.
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, error }),
    [user, isLoading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Step 3 (RED): Test the Layout Component

Create the test for the `Layout` component. This test remains largely the same, but the mock user data is updated to use the safe `SessionUser` type.

```typescript
// file: frontend/src/components/Layout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { AuthProvider, type SessionUser } from '../contexts/AuthContext';
import { api } from '../lib/api';

vi.mock('../lib/api');

const renderWithAuth = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={ui}>
            <Route path="/" element={<div>Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe('Layout', () => {
  it('renders a global loading indicator while session is loading', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithAuth(<Layout />);
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('renders header, footer, and outlet when not loading (logged out)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: null });
    renderWithAuth(<Layout />);
    expect(await screen.findByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders dynamic header for authenticated user', async () => {
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    vi.mocked(api.get).mockResolvedValue({ data: { user: mockUser } });
    renderWithAuth(<Layout />);
    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });
});
```

### Step 4 (GREEN): Implement the Layout Component

Create the `Layout.tsx` file. No changes are needed here from the original plan, as it correctly consumes the context provided.

```typescript
// file: frontend/src/components/Layout.tsx
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
              <span>Logout</span>
            </>
          ) : (
            <Link to="/login">Login</Link>
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
```

### Step 5 (RED): Test the Protected Route Component

This is a new step. We will test the `ProtectedRoute` component in isolation to verify its core logic: it should redirect unauthenticated users and render content for authenticated users.

```typescript
// file: frontend/src/components/ProtectedRoute.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContext from '../contexts/AuthContext';

// Mock the useAuth hook
vi.mock('../contexts/AuthContext');
const useAuthMock = vi.mocked(AuthContext.useAuth);

// A helper component to display the current path
const LocationDisplay = () => <div>Current Path: {useLocation().pathname}</div>;

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    useAuthMock.mockReturnValue({
      user: { id: '1', name: 'Test' },
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to the login page when user is not authenticated', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Current Path: /login')).toBeInTheDocument();
  });

  it('renders loading state while auth context is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Assuming loading state is null or a spinner, not the content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
```

### Step 6 (GREEN): Implement the Protected Route Component

Create the `ProtectedRoute.tsx` file with the logic to make the tests in Step 5 pass.

```typescript
// file: frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router
```

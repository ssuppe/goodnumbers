# Goodnumbers — Phase 5, Task 5.2

## TL;DR

Implement the V3-designed public homepage and global layout, including setting up Tailwind CSS and creating reusable, styled components for the banner, header, and footer.

## Invariants (do not change)

- The frontend application must use **Tailwind CSS** for all utility-class-based styling.
- The global styles (`index.css`) must define the V3 blue-primary color palette as CSS variables.
- The application layout must consist of distinct, reusable components for the `Banner`, `Header`, and `Footer`.
- Client-side navigation (e.g., to `/demo`, `/privacy`) must use the React Router `<Link>` component.
- Backend/external navigation (e.g., to `/api/auth/signin`) must use the standard HTML `<a>` tag and include security attributes.

## Assumptions & Scope

- **Assumption (Source of Truth):** The `Design Doc V3` (Unified Blue Primary) is the definitive source for all styling, superseding the green color palette mentioned in the older `PRD.md`.
- **Assumption:** The backend is configured to serve the Auth.js sign-in page at `/api/auth/signin`.
- **Scope:**
  - Installing and configuring Tailwind CSS.
  - Updating the global stylesheet with the V3 design system variables.
  - Creating and testing new reusable components: `Banner.tsx`, `Header.tsx`, `Footer.tsx`.
  - Creating placeholder pages with preliminary content for `/demo`, `/privacy`, and `/terms`.
  - Implementing the V3 design for the `HomePage.tsx`.
- **Out of Scope:** Full implementation of the content for the `Demo` page. Final, lawyer-approved versions of the `Privacy` or `Terms` pages.

## Objectives

1.  **Integrate Tailwind CSS:** Successfully install and configure Tailwind CSS in the `frontend` Vite project.
2.  **Establish V3 Design System:** Refactor `frontend/src/index.css` with the V3 design tokens as CSS variables.
3.  **Componentize Layout:** Create and test three new, reusable components: `Banner.tsx`, `Header.tsx`, and `Footer.tsx`.
4.  **Implement V3 Homepage:** Build the `HomePage.tsx` component to precisely match the V3 design, using the correct and secure components for internal (`<Link>`) and external (`<a>`) navigation.
5.  **Establish Placeholder Routes:** Create placeholder pages with preliminary content for `/demo`, `/privacy`, and `/terms` and add them to the main application router to prevent 404 errors.

## Risks & Mitigations

- **Risk:** Incorrect link components (`<a>` vs `<Link>`) are used, leading to poor SPA performance and user experience.
  - **Mitigation:** The plan and associated tests now explicitly differentiate between client-side and server-side navigation, with clear instructions on which component to use for each case.
- **Risk:** Clicking on newly added links (Demo, Privacy) leads to 404 errors.
  - **Mitigation:** The plan now includes a dedicated step to create placeholder pages and register their routes in `App.tsx`, ensuring all links are functional upon implementation.
- **Risk (Security):** External links are implemented insecurely, exposing the application to "tabnabbing" attacks.
  - **Mitigation:** The plan has been updated to mandate that all external `<a>` tags must include the `rel="noopener noreferrer"` attribute. The TDD process is updated to include a test that verifies this attribute's presence.

## Security & Privacy Enhancements (Rationale for Changes)

This revised plan incorporates several key security and privacy improvements that are critical to establish at this foundational stage.

1.  **Hardening External Links (Critical):** The original plan did not specify security attributes for external links. This is a common vulnerability. **The Fix:** We are mandating the use of `rel="noopener noreferrer"` on all `<a>` tags that navigate to external or cross-origin destinations.
    - **`noopener`**: Prevents the destination page from gaining access to the original page's `window` object. This mitigates "tabnabbing," a type of phishing attack where a malicious page could redirect our application's tab to a fake login page.
    - **`noreferrer`**: Prevents the browser from sending the `Referer` header to the destination page. This enhances user privacy by not revealing the page they were on before clicking the link.

2.  **Responsible Legal Placeholders:** The original plan used "content to be added later" for legal pages. For an application that will handle health data, this is not a responsible practice, even in early development. **The Fix:** We will use preliminary, template-based content for the Privacy Policy and Terms of Service pages. This demonstrates a commitment to transparency and user trust from the very first deployment, while clearly marking the documents as preliminary.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Systematically replace the placeholder UI with the new V3 design system, starting with the foundational tooling (Tailwind CSS) and building up from reusable components while ensuring all navigation paths are correctly and securely routed.
- **Mechanism:**
  1.  **Tooling & Styling:** Install and configure Tailwind CSS and update `index.css` with V3 variables.
  2.  **Componentization:** Create the `Banner`, `Header`, and `Footer` components in isolation, each with tests.
  3.  **Layout Assembly:** Rebuild `Layout.tsx` to be a simple assembler of the new components and the React Router `<Outlet />`.
  4.  **Routing:** Create placeholder components with preliminary content for `Demo`, `Privacy`, and `Terms` pages. Add them to the router configuration in `App.tsx`.
  5.  **Page Implementation:** Rebuild `HomePage.tsx` to render the V3 marketing content, using the specified Tailwind classes and correct, secure link components.
- **Trade-offs:** This robust approach has a slightly higher initial setup cost but ensures maximum maintainability, correctness, and development speed for all future UI tasks.
- **Go-No-Go Decision:** **Go**. This is the necessary path to align the application with the V3 design and ensure a correct technical foundation.

## Implementation Notes

- **File Paths:** All new components in `frontend/src/components/`, all new pages in `frontend/src/pages/`.
- **CSS Variables:** Use the `v3-*` utility classes for colors to ensure adherence to the design system.
- **Link Components:** Use `<Link>` from `react-router-dom` for `/demo`, `/privacy`, `/terms`. Use `<a href="..." rel="noopener noreferrer">` for `/api/auth/signin` and `/api/auth/signout`.
- **Future Security Consideration (Content Security Policy):** While not in scope for this task, the next major security enhancement for the frontend will be to implement a strict Content Security Policy (CSP). A CSP provides an essential defense-in-depth against Cross-Site Scripting (XSS) attacks by creating a whitelist of sources from which the browser is allowed to load resources (like scripts, styles, and images). This will be handled in a future task, but it is important to be aware of this foundational security mechanism as we build the application's shell.

## Acceptance Gates

1.  Tailwind CSS is integrated, and utility classes are correctly applied.
2.  The application reflects the new blue primary color palette.
3.  The sticky, red "NOTE" banner is present at the top of all pages.
4.  The `HomePage` renders precisely according to the V3 design specification.
5.  Clicking the "Login / Register" button navigates to the backend sign-in page, and the link is secured with `rel="noopener noreferrer"`.
6.  Clicking the "See a demo", "Privacy Policy", or "Terms of Service" links navigates to their respective placeholder pages _without_ a full browser reload.
7.  The Privacy and Terms pages display preliminary content, not just a "coming soon" message.
8.  All new and updated component tests pass.

## “Make-sure-you” Checklist

- [ ] Have you created the `tailwind.config.js` and `postcss.config.js` files?
- [ ] Does `index.css` include the `@tailwind` directives and the V3 CSS variables?
- [ ] Have you used `<Link>` for internal SPA routes (`/demo`, `/privacy`, `/terms`)?
- [ ] Have you used `<a>` with `rel="noopener noreferrer"` for backend routes (`/api/auth/signin`)?
- [ ] Have you added the new routes for the placeholder pages to `App.tsx`?

## Project hygiene prep

1.  **Create Issue:**
    ```bash
    gh issue create --title "feat(ui): P5_T5.2 Implement V3 Homepage and Global Layout" --body "Integrate Tailwind CSS and build the V3-designed public homepage, banner, header, and footer, including placeholder pages for new routes. Closes #XX"
    ```
2.  **Create Branch:**
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/phase5-task5.2-v3-homepage-layout
    ```
3.  **TDD Workflow:** Follow the Red-Green-Refactor cycle for each component and page.

## In-depth engineering plan

### Step 1: Install and Configure Tailwind CSS

First, install the necessary development dependencies from the **project root**.

```bash
npm install -D tailwindcss postcss autoprefixer -w frontend
```

Next, run the Tailwind init command to generate the configuration files.

```bash
npx tailwindcss init -p --workspace=frontend
```

Now, configure the `tailwind.config.js` and `postcss.config.js` files in the `frontend` directory.

```typescript
// file: frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

```javascript
// file: frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Step 2: Update Global Styles with V3 Design Tokens

Update `frontend/src/index.css` to include the Tailwind directives and the new V3 CSS variables.

```diff
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -1,30 +1,38 @@
+@tailwind base;
+@tailwind components;
+@tailwind utilities;
+
 :root {
-  /* Primary Color Palette */
-  --primary-color: #4caf50;
-  --primary-color-hover: #5cb85c;
-  --primary-color-active: #449d44;
-  --primary-background-light: #e8f5e9;
-
-  /* Critical Alert Color */
-  --feedback-critical-color: #d32f2f;
-
-  /* Neutral Color Palette */
-  --background-color: #f8f9fa;
-  --component-background-color: #ffffff;
-  --text-color-primary: #212529;
-  --text-color-secondary: #6c757d;
-  --border-color: #dee2e6;
-
-  /* Accent & Feedback Colors */
-  --feedback-important-color: #f57f17; /* Amber/Orange */
-
   /* Typography */
   font-family:
     -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
     Arial, sans-serif;
+  line-height: 1.5;
+  font-weight: 400;
+
   font-synthesis: none;
   text-rendering: optimizeLegibility;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
+
+  /* V3 Color Palette (from Design Spec) */
+  --primary-color: #1976d2; /* Blue */
+  --primary-color-hover: #1e88e5; /* Lighter Blue */
+  --feedback-critical-color: #d32f2f; /* Red */
+  --feedback-critical-background: #ffebee; /* Light Red */
 }

 body {
   margin: 0;
-  background-color: var(--background-color);
-  color: var(--text-color-primary);
+  background-color: #f8f9fa; /* Page Background from spec */
+  color: #212529; /* Primary Text Color from spec */
 }
+
+/* CSS Utility Mappings (from Design Spec) */
+.v3-primary-text { color: var(--primary-color); }
+.v3-bg-primary { background-color: var(--primary-color); }
+.v3-hover-bg-primary-hover:hover { background-color: var(--primary-color-hover); }
+.v3-border-primary { border-color: var(--primary-color); }
+.v3-banner-title-bg { background-color: var(--feedback-critical-color); }
```

**Verification:** At this point, you can start the dev server (`npm run dev -w frontend`) and use Tailwind classes in `HomePage.tsx` to confirm they are being applied.

### Step 3 (RED): Test the Banner Component

Create a new test file for the `Banner` component. Running the tests now will fail because the component doesn't exist.

```typescript
// file: frontend/src/components/Banner.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Banner from './Banner';

describe('Banner', () => {
  it('renders the critical medical disclaimer text', () => {
    render(<Banner />);
    expect(screen.getByText(/goodnumbers is an experiment/i)).toBeInTheDocument();
    expect(screen.getByText('NOTE')).toBeInTheDocument();
  });
});
```

### Step 4 (GREEN): Implement the Banner Component

Create the `Banner.tsx` file to make the test pass.

````typescript
// file: frontend/src/components/Banner.tsx
export default function Banner() {
  return (
    <div className="v3-banner-title-bg py-2 px-2 text-sm font-medium sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 text-white">
        <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex-shrink-0 border border-white opacity-80">
          NOTE
        </span>
        <span className="text-left leading-snug">
          GoodNumbers is an experiment and is for educational use only. Do not
          make any changes to your diabetic healthcare plan without speaking to
          your doctor.
        </span>
      </div>
    </div>
  );
}```

**Verification:** Run `npm test -w frontend`. The `Banner.test.tsx` suite should now pass.

### Step 5 (RED): Test the Header Component

Create the test file for the `Header`. It will fail.

```typescript
// file: frontend/src/components/Header.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext');
const useAuthMock = vi.mocked(AuthContext.useAuth);

describe('Header', () => {
  it('renders login link for unauthenticated users', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false, error: null });
    render(<MemoryRouter><Header /></MemoryRouter>);
    const loginLink = screen.getByText('Login / Register');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/api/auth/signin');
  });

  it('renders settings and logout links for authenticated users', () => {
    useAuthMock.mockReturnValue({ user: { id: '1', name: 'Test' }, isLoading: false, error: null });
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});
````

### Step 6 (GREEN): Implement the Header Component

Create `Header.tsx` to make the test pass.

```typescript
// file: frontend/src/components/Header.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
              <Link to="/settings" className="text-sm font-medium text-gray-500 hover:text-gray-900">
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
```

**Verification:** Run the tests. The `Header.test.tsx` suite should now pass.

### Step 7 (RED): Test the Footer Component

Create the test file for the `Footer`. It will fail.

```typescript
// file: frontend/src/components/Footer.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';

describe('Footer', () => {
  it('renders copyright and legal links', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText(/© 2025 goodnumbers, inc/i)).toBeInTheDocument();

    const privacyLink = screen.getByText('Privacy Policy');
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');

    const termsLink = screen.getByText('Terms of Service');
    expect(termsLink).toBeInTheDocument();
    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
  });
});
```

### Step 8 (GREEN): Implement the Footer Component

Create `Footer.tsx` to make the test pass.

```typescript
// file: frontend/src/components/Footer.tsx
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-12 py-8 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        &copy; 2025 GoodNumbers, Inc. | Experimental Journal for T1D. |{' '}
        <Link to="/privacy" className="hover:text-gray-700">
          Privacy Policy
        </Link>{' '}
        |{' '}
        <Link to="/terms" className="hover:text-gray-700">
          Terms of Service
        </Link>
      </div>
    </footer>
  );
}
```

**Verification:** Run the tests. The `Footer.test.tsx` suite should now pass.

### Step 9: Create Placeholder Pages and Update Router

Create the three placeholder page files first.

```````typescript
// file: frontend/src/pages/DemoPage.tsx
export default function DemoPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
      <h1 className="text-3xl font-bold">Demo Page</h1>
      <p className="mt-4">A read-only version of the journal page with sample data will be displayed here.</p>
    </div>
  );
}
``````typescript
// file: frontend/src/pages/PrivacyPage.tsx
export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose">
      <h1>Privacy Policy (Preliminary)</h1>
      <p><em>Last updated: October 11, 2025</em></p>
      <p>
        Welcome to Goodnumbers. We are committed to protecting your privacy.
        This preliminary privacy policy outlines how we handle your information
        for this experimental, educational application. A more detailed policy
        will be published before our public launch.
      </p>
      <h2>Information We Collect</h2>
      <p>
        We collect information you provide directly to us, such as when you create
        an account, as well as data from your Nightscout instance as authorized by you.
        We also collect standard analytics data to improve the service.
      </p>
      <h2>How We Use Information</h2>
      <p>
        We use the information we collect to operate, maintain, and provide you
        with the features and functionality of the Goodnumbers service. Your personal
        health information is used solely to generate your weekly journal and is not
        shared with third parties for marketing purposes.
      </p>
    </div>
  );
}
``````typescript
// file: frontend/src/pages/TermsPage.tsx
export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose">
      <h1>Terms of Service (Preliminary)</h1>
      <p><em>Last updated: October 11, 2025</em></p>
      <p>
        These terms of service govern your use of the Goodnumbers application.
        By using the service, you agree to these terms.
      </p>
      <h2>Educational Use Only</h2>
      <p>
        Goodnumbers is an experimental tool for educational purposes only. It is not
        a medical device and does not provide medical advice. Do not make any
        changes to your healthcare plan without consulting your doctor or qualified
        healthcare provider.
      </p>
      <h2>Limitation of Liability</h2>
      <p>
        The service is provided "as is," and we make no warranties regarding its
        accuracy or reliability. In no event shall we be liable for any damages
        arising from the use of this service.
      </p>
    </div>
  );
}
```````

Now, update the router in `App.tsx` to include routes for these new pages.

```diff
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -4,6 +4,9 @@
 import DashboardPage from './pages/DashboardPage';
 import AgreementsPage from './pages/AgreementsPage';
 import SetupPage from './pages/SetupPage';
+import DemoPage from './pages/DemoPage';
+import PrivacyPage from './pages/PrivacyPage';
+import TermsPage from './pages/TermsPage';

 const router = createBrowserRouter([
   {
@@ -14,6 +17,18 @@
         index: true,
         element: <HomePage />,
       },
+      {
+        path: 'demo',
+        element: <DemoPage />,
+      },
+      {
+        path: 'privacy',
+        element: <PrivacyPage />,
+      },
+      {
+        path: 'terms',
+        element: <TermsPage />,
+      },
       {
         element: <ProtectedRoute />,
         children: [

```

### Step 10 (RED): Update the Layout Test

The current `Layout.test.tsx` is insufficient. Update it to confirm it now renders all its child components correctly. This will fail initially because `Layout.tsx` is still the old version.

```typescript
// file: frontend/src/components/Layout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import * as AuthContext from '../contexts/AuthContext';

// Mock the useAuth hook since the Header component uses it
vi.mock('../contexts/AuthContext');
const useAuthMock = vi.mocked(AuthContext.useAuth);

describe('Layout', () => {
  it('renders the banner, header, footer, and child outlet content', () => {
    // Provide a mock auth state for the Header component
    useAuthMock.mockReturnValue({ user: null, isLoading: false, error: null });

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/goodnumbers is an experiment/i)).toBeInTheDocument(); // Verifies Banner
    expect(screen.getByRole('link', { name: 'GoodNumbers' })).toBeInTheDocument(); // Verifies Header
    expect(screen.getByText('Child Content')).toBeInTheDocument(); // Verifies Outlet
    expect(screen.getByText(/© 2025 goodnumbers, inc/i)).toBeInTheDocument(); // Verifies Footer
  });
});
```

### Step 11 (GREEN): Assemble the Main Layout

Refactor `Layout.tsx` to use the new components. This will make the test from Step 10 pass.

```diff
--- a/frontend/src/components/Layout.tsx
+++ b/frontend/src/components/Layout.tsx
-import { Outlet, Link } from 'react-router-dom';
-import { useAuth } from '../contexts/AuthContext';
+import { Outlet } from 'react-router-dom';
+import Banner from './Banner';
+import Header from './Header';
+import Footer from './Footer';

 export function Layout() {
-  const { user, isLoading } = useAuth();
-
-  if (isLoading) {
-    return <div>Loading session...</div>;
-  }
-
   return (
-    <div>
-      <header style={{ borderBottom: '1px solid #ccc', padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
-        <Link to="/">
-          <h1>Goodnumbers</h1>
-        </Link>
-        <nav>
-          {user ? (
-            <>
-              <Link to="/settings" style={{ marginRight: '1rem' }}>Settings</Link>
-              {/* This will be a real logout button later */}
-              <a href="/api/auth/signout">Logout</a>
-            </>
-          ) : (
-            <a href="/api/auth/signin">Login</a>
-          )}
-        </nav>
-      </header>
-      <main style={{ padding: '1rem' }}>
+    <>
+      <Banner />
+      <Header />
+      <main>
         <Outlet />
       </main>
-      <footer style={{ borderTop: '1px solid #ccc', padding: '1rem', marginTop: '2rem' }}>
-        <p>&copy; 2025 Goodnumbers. All rights reserved.</p>
-      </footer>
-    </div>
+      <Footer />
+    </>
   );
 }
```

### Step 12 (RED): Update the Homepage Test

Update the `HomePage.test.tsx` to match the security and link component requirements. This will fail because the component is still the old version.

```typescript
// file: frontend/src/pages/HomePage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders marketing content with correct internal and external links', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    // Check for headline
    expect(screen.getByRole('heading', { name: /a smart weekly journal/i })).toBeInTheDocument();

    // Check Login / Register button (external link)
    const loginLink = screen.getByRole('link', { name: /login \/ register/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/api/auth/signin');
    // SECURITY CHECK: Ensure rel attribute is present for external links
    expect(loginLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Check See a demo button (internal link)
    const demoLink = screen.getByRole('link', { name: /see a demo/i });
    expect(demoLink).toBeInTheDocument();
    expect(demoLink).toHaveAttribute('href', '/demo');
  });
});
```

### Step 13 (GREEN): Implement the V3 Homepage

Finally, update `HomePage.tsx` to implement the V3 design and make the final test pass.

```diff
--- a/frontend/src/pages/HomePage.tsx
+++ b/frontend/src/pages/HomePage.tsx
-
+import { Link } from 'react-router-dom';

 export default function HomePage() {
   return (
-    <div style={{ textAlign: 'center' }}>
-      <h1>A smart weekly journal for type 1 diabetics</h1>
-      <p>
+    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
+      <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
+        A smart weekly journal for type 1 diabetics
+      </h1>
+      <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
         <strong>GoodNumbers</strong> is an experimental weekly journal to help
         type 1 diabetics reflect and improve their blood sugar levels week to
         week. It uses a mix of good old statistical analysis to help you zero in
@@ -19,17 +20,18 @@
         and to continuously improve.
       </p>
-      <div style={{ marginTop: '2rem' }}>
-        <Link to="/demo" style={{ marginRight: '1rem' }}>
+      <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
+        <Link
+          to="/demo"
+          className="inline-block px-8 py-3 rounded-lg text-base font-medium bg-white v3-primary-text border-2 v3-border-primary hover:bg-blue-50 transition-colors"
+        >
           See a demo
         </Link>
-        <a href="/api/auth/signin">Login / Register</a>
+        <a
+          href="/api/auth/signin"
+          rel="noopener noreferrer"
+          className="inline-block px-8 py-3 rounded-lg text-base font-medium text-white v3-bg-primary border border-transparent v3-hover-bg-primary-hover hover:scale-[1.01] transition"
+        >
+          Login / Register
+        </a>
       </div>
     </div>
   );
 }
```

**Final Verification:** Run `npm test -w frontend`. All tests should now pass. Manually run the application and verify all pages and links function as expected. The task is complete. pages and links function as expected. The task is complete.

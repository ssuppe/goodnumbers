# Goodnumbers — Phase 5, Task 4

## TL;DR

Initialize the React frontend project using Vite, configure it as a monorepo workspace, and establish the core application structure including a proxied API client.

## Invariants (do not change)

- The frontend must be a Single Page Application (SPA) built with React and TypeScript.
- The frontend must communicate with the backend exclusively via the existing `/api` endpoints.
- The project must remain a cohesive monorepo leveraging npm workspaces.
- All new code must adhere to the existing linting (`ESLint`) and formatting (`Prettier`) standards.

## Assumptions & Scope

- **Assumption:** The backend development server is available at `http://localhost:3000`.
- **Assumption:** Vite is the chosen build tool for the frontend.
- **Scope:** This task is strictly limited to project scaffolding, configuration, and creating foundational, non-functional placeholder components.
- **Out of Scope:** Implementation of functional UI for login, onboarding, or the dashboard is not part of this task.

## Objectives

1.  **Scaffold Project:** Generate a new Vite React+TypeScript project within the `frontend` workspace.
2.  **Configure API Proxy:** Configure the Vite development server to correctly proxy all `/api` requests to the backend server, avoiding CORS issues.
3.  **Establish Core Structure:** Create the foundational directory structure, a global stylesheet with the design system's color palette, and a centralized API client module capable of handling CSRF tokens.
4.  **Verify Setup:** Create a placeholder `HomePage.tsx` component and a passing component test to validate that the entire development environment, including testing and workspace linking, is configured correctly.

## Risks & Mitigations

- **Risk:** Vite proxy misconfiguration leads to CORS errors or failed API requests.
  - **Mitigation:** The engineering plan provides the exact `vite.config.ts` proxy configuration and a manual verification step in the test plan to confirm connectivity.
- **Risk:** Workspace dependencies (`@goodnumbers/schemas`, `@goodnumbers/types`) are not resolved correctly within the new frontend app.
  - **Mitigation:** The plan includes explicit `npm install` instructions from the project root and a verification step that requires importing a type from `@goodnumbers/types` into a component.
- **Risk:** The CSRF token-handling mechanism in the API client is implemented incorrectly.
  - **Mitigation:** The engineering plan provides a complete, tested implementation for the `axios` API client that automates CSRF token fetching and inclusion.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Create a modern, performant frontend foundation that is tightly integrated with the monorepo's shared packages and the backend API.
- **Mechanism:**
  1.  Use **Vite** to scaffold the React project for its superior development server speed and simpler configuration.
  2.  Configure it as a new package within the existing `npm workspaces` monorepo structure.
  3.  Implement a **Vite proxy** for all `/api` calls to the backend, creating a seamless development experience.
  4.  Create a **centralized `axios` API client** to encapsulate all data-fetching logic, including automatic CSRF token management, to ensure security and maintainability.
- **Trade-offs:**
  - **Pro:** Vite offers a significantly faster and smoother developer experience compared to alternatives like Create React App.
  - **Con:** None. This is the industry-standard approach for modern React development.
- **Go/No-Go Decision:** **Go**. This task is a mandatory prerequisite for all subsequent user interface development.

## Implementation Notes

- **API Endpoint:** The frontend will consume the backend API located at `http://localhost:3000/api`. The Vite proxy will be configured for the `/api` path.
- **Attach Points:** A new `frontend/` directory will be created. The root `package.json` will be modified to include the new workspace and associated scripts.
- **CSRF Token Handling:** The API client must be designed to automatically fetch a CSRF token from `GET /api/csrf-token` on initialization. This token must then be included in the request body as `_csrf` for all subsequent state-changing requests (`POST`, `PUT`, `DELETE`).

## Acceptance Gates

1.  `npm run dev -w frontend` successfully starts the Vite dev server without errors.
2.  The placeholder `HomePage.tsx` component renders correctly in a web browser.
3.  An API call made from the frontend to a backend endpoint (e.g., `/api/health`) succeeds with a `200 OK` status, as verified in the browser's network tab.
4.  `npm test -w frontend` executes and passes the initial component test for `HomePage.tsx`.

## “Make-sure-you” Checklist

- [ ] Have you run `npm install` from the **project root** after modifying any `package.json` files?
- [ ] Does your `frontend/vite.config.ts` file contain the exact proxy configuration for `/api`?
- [ ] Does your placeholder `HomePage.tsx` component successfully import a type from `@goodnumbers/types` to confirm workspace linking works?
- [ ] Have you added the new `dev:frontend`, `build:frontend`, and `test:frontend` scripts to the **root** `package.json`?
- [ ] Have you verified that both backend and frontend dev servers can run concurrently?

## Project hygiene prep

1.  **GitHub Issue:** Create an issue to track this work.
    ````bash
    gh issue create --title "feat(ui): P5_T4 initialize react frontend project with vite" --body "As per the design doc, this task involves scaffolding the React frontend using Vite, setting up the monorepo workspace, configuring the API proxy, and establishing the core application structure."
    ```2.  **Branch:** Create a new feature branch from `main` (or the relevant `develop` branch).
    ```bash
    git checkout main
    git pull origin main
    git checkout -b feat/P5_T4-initialize-react-frontend
    ````
2.  **Commits:** Use the **Conventional Commits** standard. The work should be broken down into logical, atomic commits.

## In-depth test plan

1.  **Component Testing (Automated):** The primary goal is to validate the testing environment. A simple component test will be created to ensure Vitest and React Testing Library are correctly configured.
    - **Test Case:** The `HomePage.tsx` component should render a heading with the text "Goodnumbers Home".
    - **Implementation:** Create `frontend/src/pages/HomePage.test.tsx` and use `@testing-library/react` to render the component and assert that the heading is present in the document.

2.  **E2E Verification (Manual):** This is a critical one-time check to ensure the development environment, especially the API proxy, is functioning correctly.
    - **Steps:**
      1.  In one terminal, navigate to the project root and run `npm run dev:backend`. Wait for the server to start.
      2.  In a second terminal, navigate to the project root and run `npm run dev:frontend`.
      3.  Open the URL provided by Vite (e.g., `http://localhost:5173`) in your browser.
      4.  Open the browser's Developer Tools and switch to the "Network" tab.
      5.  **Action:** Temporarily add the following `useEffect` hook to `frontend/src/pages/HomePage.tsx` to trigger an API call on load.

          ```typescript
          import { useEffect } from "react";
          import { api } from "../lib/api"; // Assuming api.ts is in lib

          // ... inside HomePage component
          useEffect(() => {
            api
              .get("/health")
              .then((response) => {
                console.log("Health check status:", response.data.status);
              })
              .catch(console.error);
          }, []);
          ```

      6.  **Verification:** Refresh the page. Observe the Network tab for a request to `http://localhost:5173/api/health`. Confirm that it returns a `200 OK` status and the response body is `{ "status": "ok" }`. This proves the proxy is working.
      7.  **Cleanup:** Remove the temporary `useEffect` code.

## In-depth engineering plan

### Step 1: Scaffold Project and Install Dependencies

1.  **Scaffold with Vite:** In the project root, run the following command to create the frontend project.
    ```bash
    npm create vite@latest frontend -- --template react-ts
    ```
2.  **Install Core Dependencies:**
    ```bash
    npm install -w frontend axios react-router-dom
    ```
3.  **Install Dev Dependencies:**
    ```bash
    npm install -w frontend -D vitest @testing-library/react @testing-library/jest-dom jsdom
    ```

### Step 2: Configure Project Files

1.  **Configure `frontend/package.json`:** Add the shared workspace packages as dependencies.

    ```diff
    --- a/frontend/package.json
    +++ b/frontend/package.json
    @@ -1,20 +1,25 @@
     {
       "name": "frontend",
       "private": true,
       "version": "0.0.0",
       "type": "module",
       "scripts": {
         "dev": "vite",
         "build": "tsc && vite build",
         "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    -    "preview": "vite preview"
    +    "preview": "vite preview",
    +    "test": "vitest"
       },
       "dependencies": {
    +    "@goodnumbers/schemas": "workspace:*",
    +    "@goodnumbers/types": "workspace:*",
    +    "axios": "^1.7.2",
         "react": "^18.2.0",
    -    "react-dom": "^18.2.0"
    +    "react-dom": "^18.2.0",
    +    "react-router-dom": "^6.23.1"
       },
       "devDependencies": {
    +    "@testing-library/jest-dom": "^6.4.5",
    +    "@testing-library/react": "^16.0.0",
         "@types/react": "^18.2.66",
         "@types/react-dom": "^18.2.22",
         "@typescript-eslint/eslint-plugin": "^7.2.0",
         "@typescript-eslint/parser": "^7.2.0",
         "@vitejs/plugin-react": "^4.2.1",
         "eslint": "^8.57.0",
         "eslint-plugin-react-hooks": "^4.6.0",
         "eslint-plugin-react-refresh": "^0.4.6",
    -    "typescript": "^5.2.2",
    -    "vite": "^5.2.0"
    +    "typescript": "^5.2.2",
    +    "vite": "^5.2.0",
    +    "jsdom": "^24.1.0",
    +    "vitest": "^1.6.0"
       }
     }
    ```

2.  **Configure Vite (`frontend/vite.config.ts`):** Set up the API proxy and Vitest configuration.

    ```typescript
    // file: frontend/vite.config.ts
    import { defineConfig } from "vite";
    import react from "@vitejs/plugin-react";

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      server: {
        proxy: {
          // Proxy /api requests to our backend server
          "/api": {
            target: "http://localhost:3000",
            changeOrigin: true,
          },
        },
      },
      test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
      },
    });
    ```

3.  **Create Vitest Setup File (`frontend/src/setupTests.ts`):** This file is used to import Jest DOM matchers for tests.
    ```typescript
    // file: frontend/src/setupTests.ts
    import "@testing-library/jest-dom";
    ```

### Step 3: Link Workspaces

1.  **Run Installer:** From the **project root**, run `npm install`. This will link `@goodnumbers/schemas` and `@goodnumbers/types` into the `frontend` project's `node_modules`.

### Step 4: Establish Core App Structure

1.  **Create Directories:**
    ```bash
    mkdir -p frontend/src/components frontend/src/pages frontend/src/hooks frontend/src/lib
    ```
2.  **Create Global Stylesheet (`frontend/src/index.css`):** Populate it with the design system's color palette.

    ```css
    /* file: frontend/src/index.css */
    :root {
      /* Primary Color Palette */
      --primary-color: #4caf50;
      --primary-color-hover: #5cb85c;
      --primary-color-active: #449d44;
      --primary-background-light: #e8f5e9;

      /* Critical Alert Color */
      --feedback-critical-color: #d32f2f;

      /* Neutral Color Palette */
      --background-color: #f8f9fa;
      --component-background-color: #ffffff;
      --text-color-primary: #212529;
      --text-color-secondary: #6c757d;
      --border-color: #dee2e6;

      /* Accent & Feedback Colors */
      --feedback-important-color: #f57f17; /* Amber/Orange */

      /* Typography */
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
        Arial, sans-serif;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      margin: 0;
      background-color: var(--background-color);
      color: var(--text-color-primary);
    }
    ```

3.  **Create Centralized API Client (`frontend/src/lib/api.ts`):** This instance will automatically handle CSRF tokens.

    ```typescript
    // file: frontend/src/lib/api.ts
    import axios from "axios";

    export const api = axios.create({
      baseURL: "/api", // The base URL will be proxied by Vite
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Use an interceptor to dynamically add the CSRF token to relevant requests
    api.interceptors.request.use(
      async (config) => {
        if (
          ["POST", "PUT", "DELETE"].includes(config.method?.toUpperCase() ?? "")
        ) {
          // Fetch the CSRF token from the dedicated endpoint
          // This is cached by the browser, so it's efficient.
          const { data } = await axios.get("/api/csrf-token");
          config.data = { ...config.data, _csrf: data.csrfToken };
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    ```

### Step 5: Create Placeholder Components and Test

1.  **Create `HomePage` Component (`frontend/src/pages/HomePage.tsx`):**

    ```typescript
    // file: frontend/src/pages/HomePage.tsx
    import type { User } from '@goodnumbers/types'; // Verify workspace linking

    // This is just a dummy function to use the User type.
    const getDummyUser = (): User | null => {
      console.log('User type is available');
      return null;
    };

    export function HomePage() {
      getDummyUser();
      return (
        <div>
          <h1>Goodnumbers Home</h1>
        </div>
      );
    }
    ```

2.  **Update `App.tsx` for Basic Routing:**

    ```typescript
    // file: frontend/src/App.tsx
    import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
    import { HomePage } from './pages/HomePage';

    function App() {
      return (
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </Router>
      );
    }

    export default App;
    ```

3.  **Create Component Test (`frontend/src/pages/HomePage.test.tsx`):**

    ```typescript
    // file: frontend/src/pages/HomePage.test.tsx
    import { render, screen } from '@testing-library/react';
    import { describe, it, expect } from 'vitest';
    import { HomePage } from './HomePage';

    describe('HomePage', () => {
      it('renders the main heading', () => {
        render(<HomePage />);
        const headingElement = screen.getByRole('heading', {
          name: /Goodnumbers Home/i,
        });
        expect(headingElement).toBeInTheDocument();
      });
    });
    ```

### Step 6: Final Verification

1.  Run `npm test -w frontend` from the project root and confirm the test passes.
2.  Follow the manual E2E verification steps outlined in the **In-depth test plan** to confirm the API proxy is working correctly.
3.  Commit your changes following the Conventional Commits standard.
    ```bash
    git add .
    git commit -m "feat(ui): P5_T4 initialize react frontend project with vite"
    ```

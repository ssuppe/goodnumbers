This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production Error Debugging: Content Security Policy (CSP) and Cross-Origin Embedder Policy (COEP)

This section documents the debugging process for production errors related to Content Security Policy (CSP) and Cross-Origin Embedder Policy (COEP) encountered with the `LazyAudioPlayer.tsx` component.

### Problem Description

When clicking the Play button on the `LazyAudioPlayer.tsx` component in the production environment, the following errors were observed:

1.  **CSP Violation for Media:** `Refused to load media from 'https://storage.googleapis.com/...' because it violates the Content Security Policy directive: "default-src 'self'".`
2.  **CSP Violation for Connect:** `Refused to connect to 'https://api.iconify.design/...' (and similar for 'https://api.unisvg.com' and 'https://api.simplesvg.com') because it violates the Content Security Policy directive: "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.dev".`
3.  **COEP Violation for Media:** `GET https://storage.googleapis.com/... net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep 206 (Partial Content)`

These errors did not occur in the development environment.

### Diagnostic Process and Mistakes Made

1.  **Initial Hypothesis (Incorrect):** It was initially assumed that the CSP was being configured in `next.config.js` and that the issue was a missing directive there.
    *   **Mistake:** The `next.config.js` file *did* contain the correct CSP directives, but they were not being applied in production. This led to a brief period of confusion.
2.  **Root Cause Discovery:** The application is deployed as a Docker image on a virtual machine with an Nginx reverse proxy. It was discovered that Nginx was overriding the CSP headers set by Next.js. The actual CSP was being applied from `/etc/nginx/snippets/security-headers.conf`.
3.  **CSP Resolution:** The `media-src` and `connect-src` directives in `/etc/nginx/snippets/security-headers.conf` were updated to include the necessary external domains:
    *   `media-src 'self' https://storage.googleapis.com`
    *   `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.dev https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com`
4.  **COEP Error Emergence:** After resolving the CSP issues, a new error related to `Cross-Origin-Embedder-Policy` (`ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`) appeared for the Google Cloud Storage audio files.
5.  **Attempted COEP Solution 1 (GCS CORS):** The first attempt to resolve COEP was to configure CORS on the Google Cloud Storage bucket to allow cross-origin requests.
    *   **Mistake:** An initial `gsutil` command provided was incorrect, leading to a "No command was given" error. This was quickly corrected by the user.
    *   **Outcome:** The `gsutil cors set` command was successfully executed, and the GCS bucket was configured to send CORS headers. However, the COEP error persisted, indicating that CORS alone was not sufficient under the strict `require-corp` policy for embedded media.
6.  **Attempted COEP Solution 2 (Nginx COEP `unsafe-none` - Incorrect Parameter):** The next attempt was to relax the `Cross-Origin-Embedder-Policy` in Nginx by setting it to `unsafe-none`.
    *   **Mistake:** The parameter `unsafe-none` is not a valid parameter for Nginx's `add_header` directive in the way it was used, leading to an Nginx configuration test failure (`invalid parameter "unsafe-none"`).
7.  **Final COEP Solution (Remove Nginx COEP Header):** The definitive solution for the COEP error was to completely remove the `add_header Cross-Origin-Embedder-Policy "require-corp" always;` line from `/etc/nginx/snippets/security-headers.conf`. By not sending this header, the browser does not enforce the strict COEP, allowing the cross-origin media to be embedded.

### Decided Way to Approach Things (Final Solution)

The final solution involves two key modifications to the Nginx configuration file `/etc/nginx/snippets/security-headers.conf`:

1.  **Updated Content Security Policy (CSP):**
    The `add_header Content-Security-Policy` line should be updated to include the necessary domains for `media-src` and `connect-src`.

    ```nginx
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.dev; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https://storage.googleapis.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.dev https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self';" always;
    ```

2.  **Remove Cross-Origin-Embedder-Policy (COEP) Header:**
    The line `add_header Cross-Origin-Embedder-Policy "require-corp" always;` should be entirely removed from the configuration.

**Implementation Steps:**

1.  Access your virtual machine.
2.  Edit `/etc/nginx/snippets/security-headers.conf`.
3.  Replace the existing `add_header Content-Security-Policy` line with the updated one above.
4.  Remove the `add_header Cross-Origin-Embedder-Policy` line.
5.  Reload or restart Nginx (e.g., `sudo systemctl reload nginx`).

This comprehensive approach resolves both the CSP and COEP issues, allowing the `LazyAudioPlayer` to function correctly in production.

const authContainer = document.getElementById('auth-container');

async function updateUI() {
  try {
    const res = await fetch('/api/session');
    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }
    const session = await res.json();

    if (session && session.user) {
      // If the user is logged in, redirect them to the dashboard.
      // The dashboard is the main entry point to the application,
      // and its associated middleware will handle the onboarding flow.
      authContainer.innerHTML = `<p><strong>Status:</strong> Logged in. Redirecting to your dashboard...</p>`;
      window.location.href = '/dashboard';
    } else {
      // If the user is logged out, show the sign-in options.
      // We need a CSRF token to make the sign-in form work correctly.
      const csrfRes = await fetch('/api/auth/csrf');
      if (!csrfRes.ok) {
        throw new Error(`Failed to fetch CSRF token: ${csrfRes.status}`);
      }
      const { csrfToken } = await csrfRes.json();

      authContainer.innerHTML = `
        <p><strong>Status:</strong> Logged out</p>
        <form action="/api/auth/signin/google" method="POST">
            <input type="hidden" name="csrfToken" value="${csrfToken}">
            <button type="submit">Sign in with Google</button>
        </form>
      `;
    }
  } catch (error) {
    console.error('Error updating UI:', error);
  }
}

// Update the UI when the page loads
document.addEventListener('DOMContentLoaded', updateUI);

const authContainer = document.getElementById("auth-container");

async function updateUI() {
  try {
    // Fetch CSRF token first, as it's needed for both sign-in and sign-out forms
    const csrfRes = await fetch("/api/auth/csrf");
    if (!csrfRes.ok) {
      throw new Error(`Failed to fetch CSRF token: ${csrfRes.status}`);
    }
    const { csrfToken } = await csrfRes.json();

    const res = await fetch("/api/session");
    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }
    const session = await res.json();

    if (session && session.user) {
      // User is logged in
      authContainer.innerHTML = `
        <p><strong>Status:</strong> Logged in</p>
        <p><strong>Email:</strong> ${session.user.email}</p>
        <form action="/api/auth/signout" method="POST">
            <input type="hidden" name="csrfToken" value="${csrfToken}">
            <button type="submit">Sign Out</button>
        </form>
      `;
    } else {
      // User is logged out
      authContainer.innerHTML = `
        <p><strong>Status:</strong> Logged out</p>
        <form action="/api/auth/signin/google" method="POST">
            <input type="hidden" name="csrfToken" value="${csrfToken}">
            <button type="submit">Sign in with Google</button>
        </form>
      `;
    }
  } catch (error) {
    console.error("Error fetching session or CSRF token:", error);
    authContainer.innerHTML = `<p style="color: red;">Error. See console for details.</p>`;
  }
}

// Update the UI when the page loads
document.addEventListener("DOMContentLoaded", updateUI);

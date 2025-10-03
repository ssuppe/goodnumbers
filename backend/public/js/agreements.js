document
  .getElementById('agreement-form')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'Saving...';

    // 1. Fetch CSRF token
    const csrfResponse = await fetch('/api/csrf-token');
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementsSigned: true, _csrf: csrfToken }), // 2. Include CSRF token
    });
    if (response.ok) {
      window.location.href = '/setup-account';
    } else {
      const errorData = await response.json();
      messageEl.textContent = `An error occurred: ${errorData.error || response.statusText}`;
    }
  });

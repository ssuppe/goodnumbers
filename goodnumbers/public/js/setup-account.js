document
  .getElementById('settings-form')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'Saving...';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (data.nightscoutUrl === '') data.nightscoutUrl = null;
    if (data.nightscoutToken === '') data.nightscoutToken = null;

    // 1. Fetch CSRF token
    const csrfResponse = await fetch('/api/csrf-token');
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    // Add CSRF token to the data object
    data._csrf = csrfToken;

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        messageEl.textContent = 'Settings saved successfully! Redirecting...';
        setTimeout(() => (window.location.href = '/dashboard'), 1500);
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.errors
          ? errorData.errors[0].message
          : errorData.error || 'Could not save settings.'; // Improved error message
        messageEl.textContent = 'Error: ' + errorMsg;
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      messageEl.textContent = 'A network error occurred. Please try again.';
    }
  });

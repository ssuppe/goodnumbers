document
  .getElementById('agreement-form')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'Saving...';
    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementsSigned: true }),
    });
    if (response.ok) {
      window.location.href = '/setup-account';
    } else {
      messageEl.textContent = 'An error occurred.';
    }
  });

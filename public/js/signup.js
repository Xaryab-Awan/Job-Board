document.getElementById('submit').addEventListener('click', async () => {
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      password: document.getElementById('password').value,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('error').textContent = data.error;
    return;
  }
  window.location.href = '/';
});
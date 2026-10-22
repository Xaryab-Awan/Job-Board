document.getElementById('submit').addEventListener('click', async () => {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('error').textContent = data.error;
    return;
  }
  window.location.href = data.role === 'admin' ? '/admin.html' : '/';
});
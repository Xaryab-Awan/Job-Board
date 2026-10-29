const form = document.getElementById("profile-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

async function init() {
  const user = await loadUser();
  if (!user) return;
  renderNav("profile");

  nameInput.value = user.name || "";
  emailInput.value = user.email || "";
  phoneInput.value = user.phone || "";
}

// A real <form>, so pressing Enter saves too.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showAlert(statusEl, "", "danger");
  saveBtn.disabled = true;

  try {
    const res = await fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.value,
        email: emailInput.value,
        phone: phoneInput.value,
        password: passwordInput.value,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await res.json();

    if (!res.ok) {
      showAlert(statusEl, data.error, "danger");
      return;
    }

    passwordInput.value = "";
    showAlert(statusEl, "Profile saved.", "success");
  } catch (err) {
    console.error(err);
    showAlert(statusEl, "Could not reach the server. Try again.", "danger");
  } finally {
    saveBtn.disabled = false;
  }
});

init();

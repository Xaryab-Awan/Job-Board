const form = document.getElementById("signup-form");
const errorBox = document.getElementById("error");
const submitBtn = document.getElementById("submit");

// A real <form>, so pressing Enter works too.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showAlert(errorBox, "", "danger");
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(errorBox, data.error, "danger");
      return;
    }
    window.location.href = "/";
  } catch (err) {
    console.error(err);
    showAlert(errorBox, "Could not reach the server. Try again.", "danger");
  } finally {
    submitBtn.disabled = false;
  }
});

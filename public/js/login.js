const form = document.getElementById("login-form");
const errorBox = document.getElementById("error");
const submitBtn = document.getElementById("submit");

// A real <form>, so pressing Enter logs in too.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showAlert(errorBox, "", "danger");
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(errorBox, data.error, "danger");
      return;
    }
    // Admin goes to the administration page, everybody else to the job board.
    window.location.href = data.role === "admin" ? "/admin.html" : "/";
  } catch (err) {
    console.error(err);
    showAlert(errorBox, "Could not reach the server. Try again.", "danger");
  } finally {
    submitBtn.disabled = false;
  }
});

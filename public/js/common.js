// Shared by every page. Load it BEFORE the page's own script.

let currentUser = null;

// Create an element with a class and a text.
// It uses textContent, so values from the database are never run as HTML.
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Show (or hide, when the message is empty) a Bootstrap alert box.
// kind is "success" or "danger".
function showAlert(box, message, kind) {
  box.className = `alert alert-${kind} py-2 mt-3 mb-0`;
  box.textContent = message || "";
  box.hidden = !message;
}

// "2026-10-27T13:22:39.000Z" becomes "27 Oct 2026, 13:22" (in the user's time zone).
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Asks the server who is logged in. If nobody is, go to the login page.
async function loadUser() {
  const res = await fetch("/api/me");
  if (!res.ok) {
    window.location.href = "/login.html";
    return null;
  }
  currentUser = await res.json();
  return currentUser;
}

// Draws the links of the navbar.
// `active` is "jobs", "applications", "profile" or "admin".
function renderNav(active) {
  const nav = document.getElementById("nav-links");
  nav.replaceChildren();

  const addLink = (text, href, key) => {
    const li = el("li", "nav-item");
    const a = el("a", "nav-link", text);
    a.href = href;
    if (key === active) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
    li.append(a);
    nav.append(li);
  };

  addLink("Jobs", "/", "jobs");
  addLink("My applications", "/applications.html", "applications");
  addLink("My profile", "/profile.html", "profile");
  if (currentUser.role === "admin") addLink("Admin", "/admin.html", "admin");

  const li = el("li", "nav-item ms-md-2 mt-2 mt-md-0");
  const logout = el("button", "btn btn-outline-secondary btn-sm", "Log out");
  logout.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
  li.append(logout);
  nav.append(li);
}

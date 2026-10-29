const list = document.getElementById("ads");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

// Bootstrap classes of the grey box that opens under a job.
const PANEL =
  "bg-body-tertiary border-start border-3 border-primary rounded-end p-3 mt-3";

// Each entry: { ad, item } where item is the DOM element of that job.
const entries = [];

// ---------- LEARN MORE: the full details ----------
function fillDetails(box, full) {
  box.replaceChildren();

  const facts = el("dl", "row row-cols-2 row-cols-md-4 g-3 mb-3");
  [
    ["Company", full.company_name],
    ["Location", full.location],
    ["Wage", full.wage],
    ["Working time", full.working_time],
  ].forEach(([label, value]) => {
    const col = el("div", "col");
    col.append(
      el("dt", "small fw-normal text-body-secondary", label),
      el("dd", "fw-semibold mb-0", value || "Not specified"),
    );
    facts.append(col);
  });

  box.append(facts, el("p", "mb-0 job-full", full.full_description));
}

// ---------- APPLY: the form ----------
function buildApplyForm(box, ad, onApplied) {
  // 1. Who is applying: the details come from the user's profile.
  const who = el("div", "card card-body py-2 px-3 mb-3");
  who.append(el("div", "fw-bold", currentUser.name));
  who.append(el("div", "text-body-secondary", currentUser.email));
  if (currentUser.phone) {
    who.append(el("div", "text-body-secondary", currentUser.phone));
  }
  const note = el("div", "small mt-2", "These details are sent with your application. ");
  const link = el("a", "", "Edit your profile");
  link.href = "/profile.html";
  note.append(link);
  who.append(note);

  // 2. The message
  const field = el("div", "mb-3");
  const label = el("label", "form-label fw-semibold", "Message to the recruiter");
  const message = el("textarea", "form-control");
  message.rows = 5;
  message.id = "message-" + ad.id;
  label.htmlFor = message.id;
  field.append(label, message);

  // 3. Send button + alert
  const send = el("button", "btn btn-primary", "Send application");
  const alertBox = el("div", "");
  alertBox.setAttribute("role", "alert");
  alertBox.hidden = true;

  send.addEventListener("click", async () => {
    const text = message.value.trim();
    if (!text) {
      showAlert(alertBox, "Write a short message before sending.", "danger");
      return;
    }

    send.disabled = true;
    showAlert(alertBox, "", "danger");

    try {
      const res = await fetch(`/api/ads/${ad.id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      const data = await res.json();

      // 409 = the user already applied to this job (for example in another tab)
      if (res.ok || res.status === 409) {
        onApplied(ad, res.ok);
        return;
      }
      showAlert(alertBox, data.error, "danger");
      send.disabled = false;
    } catch (err) {
      console.error(err);
      showAlert(alertBox, "Could not reach the server. Try again.", "danger");
      send.disabled = false;
    }
  });

  box.append(who, field, send, alertBox);
}

// ---------- One job in the list ----------
function renderAd(ad, onApplied) {
  const item = el("article", "list-group-item p-3 p-md-4");

  // Left side: the text
  const text = el("div", "flex-grow-1");
  text.append(el("h2", "h5 fw-bold mb-1", ad.title));
  text.append(el("p", "fw-semibold text-body-secondary mb-2", ad.company_name));
  text.append(el("p", "mb-2", ad.short_description));

  const meta = el("div", "d-flex flex-wrap gap-2");
  [ad.location, ad.wage, ad.working_time]
    .filter(Boolean)
    .forEach((value) =>
      meta.append(el("span", "badge rounded-pill text-bg-light border fw-normal", value)),
    );
  text.append(meta);

  // Right side: the two buttons
  const learn = el(
    "button",
    "btn btn-outline-secondary flex-fill flex-md-grow-0",
    "Learn more",
  );
  learn.setAttribute("aria-expanded", "false");
  const apply = el("button", "btn btn-primary flex-fill flex-md-grow-0", "Apply");
  apply.setAttribute("aria-expanded", "false");
  const actions = el("div", "d-flex gap-2 flex-shrink-0 align-self-md-start");
  actions.append(learn, apply);

  const head = el("div", "d-flex flex-column flex-md-row justify-content-between gap-3");
  head.append(text, actions);

  // Two hidden panels under the job
  const details = el("div", PANEL);
  details.hidden = true;
  const form = el("div", PANEL);
  form.hidden = true;

  item.append(head, details, form);

  // LEARN MORE: fetch the full ad from the API once, then show/hide it
  let detailsLoaded = false;
  learn.addEventListener("click", async () => {
    if (!details.hidden) {
      details.hidden = true;
      learn.textContent = "Learn more";
      learn.setAttribute("aria-expanded", "false");
      return;
    }

    if (!detailsLoaded) {
      const res = await fetch("/api/ads/" + ad.id);
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (!res.ok) {
        const msg = el("div", "");
        showAlert(msg, "Could not load the details. Try again.", "danger");
        details.replaceChildren(msg);
      } else {
        fillDetails(details, await res.json());
        detailsLoaded = true;
      }
    }

    details.hidden = false;
    learn.textContent = "Hide details";
    learn.setAttribute("aria-expanded", "true");
  });

  // APPLY: build the form the first time, then show/hide it
  apply.addEventListener("click", () => {
    if (!form.hidden) {
      form.hidden = true;
      apply.setAttribute("aria-expanded", "false");
      return;
    }
    if (form.childElementCount === 0) buildApplyForm(form, ad, onApplied);
    form.hidden = false;
    apply.setAttribute("aria-expanded", "true");
  });

  return item;
}

// ---------- After applying: the job leaves the board ----------
// The row becomes a short confirmation (it is gone at the next page load,
// because the server no longer lists jobs the user applied to).
function markApplied(ad, justSent) {
  const index = entries.findIndex((e) => e.ad.id === ad.id);
  if (index === -1) return;
  const { item } = entries[index];
  entries.splice(index, 1);

  const box = el("div", "alert alert-success mb-0");
  box.append(
    justSent
      ? `Application sent for ${ad.title}. `
      : `You already applied to ${ad.title}. `,
  );
  const link = el("a", "alert-link", "Follow its status in My applications.");
  link.href = "/applications.html";
  box.append(link);
  item.replaceChildren(box);
  applySearch();
}

// ---------- Search: hide the jobs that don't match ----------
function applySearch() {
  const q = searchEl.value.trim().toLowerCase();
  let shown = 0;

  entries.forEach(({ ad, item }) => {
    const haystack = [
      ad.title,
      ad.company_name,
      ad.location,
      ad.short_description,
    ]
      .join(" ")
      .toLowerCase();
    const match = haystack.includes(q);
    item.hidden = !match;
    if (match) shown++;
  });

  if (entries.length === 0) {
    countEl.textContent = "";
  } else if (shown === 0) {
    countEl.textContent = "No position matches your search.";
  } else {
    countEl.textContent = `${shown} ${shown === 1 ? "position" : "positions"}`;
  }
}

// ---------- Start ----------
async function init() {
  const user = await loadUser();
  if (!user) return;
  renderNav("jobs");

  const res = await fetch("/api/ads");
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!res.ok) {
    list.append(
      el(
        "div",
        "list-group-item p-4 text-body-secondary",
        "Could not load the jobs. Refresh the page to try again.",
      ),
    );
    return;
  }

  const ads = await res.json();
  if (ads.length === 0) {
    list.append(
      el(
        "div",
        "list-group-item p-4 text-body-secondary",
        "No open positions right now. The jobs you applied to are in My applications.",
      ),
    );
    return;
  }

  ads.forEach((ad) => {
    const item = renderAd(ad, markApplied);
    entries.push({ ad, item });
    list.append(item);
  });
  applySearch();
}

searchEl.addEventListener("input", applySearch);
init();

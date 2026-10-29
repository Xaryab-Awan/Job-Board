const list = document.getElementById("list");
const countEl = document.getElementById("count");

// How each status looks and what it means for the user.
const STATUS = {
  pending: {
    label: "Pending",
    badge: "text-bg-warning",
    note: "Waiting for the recruiter's answer.",
  },
  accepted: {
    label: "Accepted",
    badge: "text-bg-success",
    note: "The recruiter accepted your application. The job is no longer on the board.",
  },
  rejected: {
    label: "Rejected",
    badge: "text-bg-danger",
    note: "The recruiter did not select your application.",
  },
};

function renderApplication(app) {
  const info = STATUS[app.status] || STATUS.pending;
  const item = el("article", "list-group-item p-3 p-md-4");

  // Title, company and date on the left, status on the right
  const text = el("div", "flex-grow-1");
  text.append(el("h2", "h5 fw-bold mb-1", app.ad_title || "Job removed"));
  text.append(el("p", "fw-semibold text-body-secondary mb-1", app.company_name || ""));
  text.append(el("p", "small text-body-secondary mb-0", "Applied on " + formatDate(app.created_at)));

  const badge = el("span", `badge ${info.badge} align-self-start fs-6 fw-semibold`, info.label);

  const head = el("div", "d-flex justify-content-between gap-3");
  head.append(text, badge);

  // The message the user sent, then a line explaining the status
  const message = el(
    "div",
    "bg-body-tertiary border-start border-3 border-primary rounded-end p-3 mt-3",
  );
  message.append(
    el("div", "small text-body-secondary mb-1", "Your message"),
    el("div", "job-full", app.message),
  );

  item.append(head, message, el("p", "small text-body-secondary mt-3 mb-0", info.note));
  return item;
}

async function init() {
  const user = await loadUser();
  if (!user) return;
  renderNav("applications");

  const res = await fetch("/api/me/applications");
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!res.ok) {
    list.append(
      el("div", "list-group-item p-4 text-body-secondary", "Could not load your applications. Refresh the page to try again."),
    );
    return;
  }

  const applications = await res.json();
  if (applications.length === 0) {
    const empty = el("div", "list-group-item p-4 text-body-secondary");
    empty.append("You have not applied to any job yet. ");
    const link = el("a", "", "Browse the open positions.");
    link.href = "/";
    empty.append(link);
    list.append(empty);
    return;
  }

  countEl.textContent = `${applications.length} ${applications.length === 1 ? "application" : "applications"}`;
  applications.forEach((app) => list.append(renderApplication(app)));
}

init();

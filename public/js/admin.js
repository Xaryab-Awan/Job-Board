// What each admin table shows (columns) and what its form asks for (fields).
// Names are shown instead of ids: the server joins the tables for us.
//   column type: "date" -> formatted date, "status" -> badge (+ accept/reject)
//   field type:  "lookup" -> dropdown filled with names from the server
const TABLES = {
  users: {
    tab: "Users",
    singular: "user",
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "role", label: "Role" },
      { key: "created_at", label: "Joined", type: "date" },
    ],
    fields: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "role", label: "Role", type: "select", options: ["user", "admin"] },
      { key: "password", label: "Password", type: "password" },
    ],
  },
  companies: {
    tab: "Companies",
    singular: "company",
    columns: [
      { key: "name", label: "Name" },
      { key: "website", label: "Website" },
      { key: "location", label: "Location" },
    ],
    fields: [
      { key: "name", label: "Name" },
      { key: "website", label: "Website" },
      { key: "location", label: "Location" },
    ],
  },
  ads: {
    tab: "Jobs",
    singular: "job",
    columns: [
      { key: "title", label: "Title" },
      { key: "company_name", label: "Company" },
      { key: "owner_name", label: "Owner" },
      { key: "location", label: "Location" },
      { key: "wage", label: "Wage" },
      { key: "working_time", label: "Working time" },
      { key: "created_at", label: "Posted", type: "date" },
    ],
    fields: [
      { key: "title", label: "Title" },
      { key: "company_id", label: "Company", type: "lookup", lookup: "companies" },
      { key: "owner_id", label: "Owner", type: "lookup", lookup: "users" },
      { key: "short_description", label: "Short description" },
      { key: "wage", label: "Wage" },
      { key: "location", label: "Location" },
      { key: "working_time", label: "Working time" },
      { key: "full_description", label: "Full description", type: "textarea" },
    ],
  },
  applications: {
    tab: "Applications",
    singular: "application",
    columns: [
      { key: "ad_title", label: "Job" },
      { key: "company_name", label: "Company" },
      { key: "applicant_name", label: "Applicant" },
      { key: "message", label: "Message" },
      { key: "status", label: "Status", type: "status" },
      { key: "created_at", label: "Applied", type: "date" },
    ],
    fields: [
      { key: "ad_id", label: "Job", type: "lookup", lookup: "ads" },
      { key: "user_id", label: "Applicant", type: "lookup", lookup: "users" },
      { key: "message", label: "Message", type: "textarea" },
    ],
  },
};

const STATUS_BADGE = {
  pending: ["Pending", "text-bg-warning"],
  accepted: ["Accepted", "text-bg-success"],
  rejected: ["Rejected", "text-bg-danger"],
};

let table = "ads";
let page = 1;
let editingId = null;
let lookupCache = {};

const $ = (id) => document.getElementById(id);

async function init() {
  const user = await loadUser();
  if (!user) return;
  if (user.role !== "admin") {
    window.location.href = "/";
    return;
  }
  renderNav("admin");
  renderTabs();
  await renderForm();
  loadRows();
}

// ---------- Tabs ----------
function renderTabs() {
  $("tabs").replaceChildren();
  Object.keys(TABLES).forEach((t) => {
    const li = el("li", "nav-item");
    const btn = el("button", "nav-link" + (t === table ? " active" : ""), TABLES[t].tab);
    btn.type = "button";
    btn.addEventListener("click", async () => {
      table = t;
      page = 1;
      showAlert($("table-message"), "", "danger");
      renderTabs();
      await resetForm();
      loadRows();
    });
    li.append(btn);
    $("tabs").append(li);
  });
}

// ---------- Form ----------
// The dropdown lists (companies, users, jobs) are loaded once, then reused.
async function getLookup(name) {
  if (!lookupCache[name]) {
    const res = await fetch(`/api/admin/lookup/${name}`);
    lookupCache[name] = res.ok ? await res.json() : [];
  }
  return lookupCache[name];
}

async function renderForm(values = {}) {
  const fields = TABLES[table].fields;

  const lists = {};
  for (const f of fields) {
    if (f.type === "lookup") lists[f.key] = await getLookup(f.lookup);
  }

  const box = $("form-fields");
  box.replaceChildren();
  fields.forEach((f) => {
    const col = el("div", f.type === "textarea" ? "col-12" : "col-md-4");
    const label = el("label", "form-label small text-body-secondary mb-1", f.label);
    label.htmlFor = "f-" + f.key;

    let input;
    if (f.type === "lookup") {
      input = el("select", "form-select form-select-sm");
      input.append(new Option("Choose...", ""));
      lists[f.key].forEach((o) => input.append(new Option(o.label, o.id)));
    } else if (f.type === "select") {
      input = el("select", "form-select form-select-sm");
      f.options.forEach((o) => input.append(new Option(o, o)));
    } else if (f.type === "textarea") {
      input = el("textarea", "form-control form-control-sm");
      input.rows = 3;
    } else {
      input = el("input", "form-control form-control-sm");
      if (f.type) input.type = f.type;
      if (f.type === "password" && editingId) input.placeholder = "leave empty to keep";
    }
    input.id = "f-" + f.key;
    if (f.type !== "password" && values[f.key] !== undefined && values[f.key] !== null) {
      input.value = values[f.key];
    }
    col.append(label, input);
    box.append(col);
  });
}

async function resetForm() {
  editingId = null;
  $("form-title").textContent = `Add a ${TABLES[table].singular}`;
  $("save").textContent = "Add";
  $("cancel").hidden = true;
  showAlert($("form-error"), "", "danger");
  await renderForm();
}

// ---------- Accept / reject an application ----------
async function decide(row, status) {
  const accept = status === "accepted";
  const question = accept
    ? `Accept the application of ${row.applicant_name} for "${row.ad_title}"?\n\nThe job will be removed from the board and the other pending applications for it will be rejected.`
    : `Reject the application of ${row.applicant_name} for "${row.ad_title}"?`;
  if (!confirm(question)) return;

  const res = await fetch(`/api/admin/applications/${row.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) {
    showAlert($("table-message"), data.error, "danger");
    loadRows();
    return;
  }
  lookupCache = {};
  showAlert(
    $("table-message"),
    accept
      ? "Application accepted. The job was removed from the board and the other pending applications for it were rejected."
      : "Application rejected.",
    "success",
  );
  loadRows();
}

// ---------- Table ----------
function buildCell(column, row) {
  const td = el("td");
  const value = row[column.key];

  if (column.type === "date") {
    td.textContent = formatDate(value);
  } else if (column.type === "status") {
    const [text, cls] = STATUS_BADGE[value] || STATUS_BADGE.pending;
    td.append(el("span", `badge ${cls}`, text));
    if (value === "pending") {
      const buttons = el("div", "d-flex gap-1 mt-1");
      const accept = el("button", "btn btn-success btn-sm py-0", "Accept");
      accept.type = "button";
      accept.addEventListener("click", () => decide(row, "accepted"));
      const reject = el("button", "btn btn-outline-danger btn-sm py-0", "Reject");
      reject.type = "button";
      reject.addEventListener("click", () => decide(row, "rejected"));
      buttons.append(accept, reject);
      td.append(buttons);
    }
  } else {
    const text = value === null || value === undefined ? "" : String(value);
    td.textContent = text.length > 60 ? text.slice(0, 57) + "..." : text;
  }
  return td;
}

async function loadRows() {
  const cfg = TABLES[table];
  const res = await fetch(`/api/admin/${table}?page=${page}&limit=10`);
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json();
  if (data.page > data.pages && data.pages > 0) {
    page = data.pages;
    return loadRows();
  }

  const thead = $("thead");
  const tbody = $("tbody");
  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = el("tr");
  [...cfg.columns.map((c) => c.label), "Actions"].forEach((label) =>
    headRow.append(el("th", "text-nowrap", label)),
  );
  thead.append(headRow);

  data.rows.forEach((row) => {
    const tr = el("tr");
    cfg.columns.forEach((column) => tr.append(buildCell(column, row)));

    const edit = el("button", "btn btn-outline-primary btn-sm me-1", "Edit");
    edit.type = "button";
    edit.addEventListener("click", async () => {
      editingId = row.id;
      $("form-title").textContent = `Edit ${cfg.singular}`;
      $("save").textContent = "Save changes";
      $("cancel").hidden = false;
      showAlert($("form-error"), "", "danger");
      await renderForm(row);
      window.scrollTo(0, 0);
    });

    const del = el("button", "btn btn-outline-danger btn-sm", "Delete");
    del.type = "button";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete this ${cfg.singular}?`)) return;
      const r = await fetch(`/api/admin/${table}/${row.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json();
        showAlert($("table-message"), d.error, "danger");
        return;
      }
      lookupCache = {};
      showAlert($("table-message"), "", "danger");
      loadRows();
    });

    const actions = el("td", "text-nowrap");
    actions.append(edit, del);
    tr.append(actions);
    tbody.append(tr);
  });

  if (data.rows.length === 0) {
    const tr = el("tr");
    const td = el("td", "text-body-secondary p-3", "No records yet");
    td.colSpan = cfg.columns.length + 1;
    tr.append(td);
    tbody.append(tr);
  }

  const n = data.total;
  $("page-info").textContent =
    `Page ${data.page} of ${Math.max(data.pages, 1)} (${n} ${n === 1 ? "record" : "records"})`;
  $("prev").disabled = data.page <= 1;
  $("next").disabled = data.page >= data.pages;
}

// ---------- Save (create or update) ----------
// A real <form>, so pressing Enter saves too.
$("admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {};
  TABLES[table].fields.forEach((f) => (body[f.key] = $("f-" + f.key).value));
  const url = editingId
    ? `/api/admin/${table}/${editingId}`
    : `/api/admin/${table}`;
  const res = await fetch(url, {
    method: editingId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    showAlert($("form-error"), data.error, "danger");
    return;
  }
  lookupCache = {};
  await resetForm();
  loadRows();
});

$("cancel").addEventListener("click", resetForm);
$("prev").addEventListener("click", () => {
  page--;
  loadRows();
});
$("next").addEventListener("click", () => {
  page++;
  loadRows();
});

init();

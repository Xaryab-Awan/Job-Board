// Which inputs the form shows for each table (the server has its own whitelist).
const FIELDS = {
  users: ["name", "email", "phone", "role", "password"],
  companies: ["name", "website", "location"],
  ads: [
    "title",
    "short_description",
    "full_description",
    "wage",
    "location",
    "working_time",
    "company_id",
    "owner_id",
  ],
  applications: ["ad_id", "user_id", "message"],
};

let table = "ads";
let page = 1;
let editingId = null;

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
  renderForm();
  loadRows();
}

function renderTabs() {
  $("tabs").replaceChildren();
  Object.keys(FIELDS).forEach((t) => {
    const li = el("li", "nav-item");
    const btn = el("button", "nav-link" + (t === table ? " active" : ""), t);
    btn.type = "button";
    btn.addEventListener("click", () => {
      table = t;
      page = 1;
      resetForm();
      renderTabs();
      showAlert($("table-error"), "", "danger");
      loadRows();
    });
    li.append(btn);
    $("tabs").append(li);
  });
}

function renderForm(values = {}) {
  const box = $("form-fields");
  box.replaceChildren();
  FIELDS[table].forEach((f) => {
    const col = el("div", "col-md-3");
    const label = el("label", "form-label small text-body-secondary mb-1", f);
    label.htmlFor = "f-" + f;

    let input;
    if (f === "role") {
      input = el("select", "form-select form-select-sm");
      ["user", "admin"].forEach((v) => input.append(new Option(v, v)));
    } else {
      input = el("input", "form-control form-control-sm");
      if (f === "password") {
        input.type = "password";
        if (editingId) input.placeholder = "leave empty to keep";
      }
    }
    input.id = "f-" + f;
    if (f !== "password" && values[f] !== undefined && values[f] !== null) {
      input.value = values[f];
    }
    col.append(label, input);
    box.append(col);
  });
}

function resetForm() {
  editingId = null;
  $("form-title").textContent = "Create a record";
  $("save").textContent = "Create";
  $("cancel").hidden = true;
  showAlert($("form-error"), "", "danger");
  renderForm();
}

async function loadRows() {
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

  const cols = [
    "id",
    ...FIELDS[table].filter((f) => f !== "password"),
    "created_at",
  ];
  const thead = $("thead");
  const tbody = $("tbody");
  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = el("tr");
  [...cols, "actions"].forEach((c) => headRow.append(el("th", "text-nowrap", c)));
  thead.append(headRow);

  data.rows.forEach((row) => {
    const tr = el("tr");
    cols.forEach((c) => {
      const v = row[c];
      tr.append(el("td", "", v === null || v === undefined ? "" : String(v).slice(0, 60)));
    });

    const edit = el("button", "btn btn-outline-primary btn-sm me-1", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => {
      editingId = row.id;
      $("form-title").textContent = `Edit ${table} #${row.id}`;
      $("save").textContent = "Save changes";
      $("cancel").hidden = false;
      showAlert($("form-error"), "", "danger");
      renderForm(row);
      window.scrollTo(0, 0);
    });

    const del = el("button", "btn btn-outline-danger btn-sm", "Delete");
    del.type = "button";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete ${table} #${row.id}?`)) return;
      const r = await fetch(`/api/admin/${table}/${row.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json();
        showAlert($("table-error"), d.error, "danger");
        return;
      }
      showAlert($("table-error"), "", "danger");
      loadRows();
    });

    const actions = el("td", "text-nowrap");
    actions.append(edit, del);
    tr.append(actions);
    tbody.append(tr);
  });

  if (data.rows.length === 0) {
    const tr = el("tr");
    const td = el("td", "text-body-secondary p-3", "No records");
    td.colSpan = cols.length + 1;
    tr.append(td);
    tbody.append(tr);
  }

  $("page-info").textContent =
    `Page ${data.page} of ${Math.max(data.pages, 1)} (${data.total} records)`;
  $("prev").disabled = data.page <= 1;
  $("next").disabled = data.page >= data.pages;
}

// A real <form>, so pressing Enter saves too.
$("admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {};
  FIELDS[table].forEach((f) => (body[f] = $("f-" + f).value));
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
  resetForm();
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

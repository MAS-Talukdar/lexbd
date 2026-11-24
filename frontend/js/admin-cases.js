const caseForm = document.getElementById("caseForm");
const caseFormSection = document.getElementById("caseFormSection");
const casesTableBody = document.getElementById("casesTableBody");
const caseMessage = document.getElementById("caseMessage");
const saveCaseButton = document.getElementById("saveCaseButton");

let currentCases = [];

document.getElementById("currentYear").textContent = new Date().getFullYear();

function showCaseMessage(message, type = "error") {
  caseMessage.textContent = message;
  caseMessage.className = "rounded-lg p-4 mb-6 text-sm";

  caseMessage.classList.add(
    type === "success" ? "bg-green-50" : "bg-red-50",
    type === "success" ? "text-green-700" : "text-red-700",
  );
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function getStatusBadge(status) {
  const styles = {
    published: "bg-green-50 text-green-700",
    draft: "bg-amber-50 text-amber-700",
    archived: "bg-slate-200 text-slate-700",
  };

  const style = styles[status] || "bg-slate-100 text-slate-600";

  return `
        <span class="${style} px-3 py-1 rounded-full text-xs">
            ${escapeHTML(status || "unknown")}
        </span>
    `;
}

function renderCases(cases) {
  currentCases = cases;

  if (!cases.length) {
    casesTableBody.innerHTML = `
            <tr>
                <td colspan="5"
                    class="px-5 py-10 text-center text-slate-500">
                    No cases found.
                </td>
            </tr>
        `;
    return;
  }

  casesTableBody.innerHTML = cases
    .map(
      (item) => `
        <tr class="border-t border-slate-100 hover:bg-slate-50">

            <td class="px-5 py-4 font-medium text-slate-800">
                ${escapeHTML(item.title)}
            </td>

            <td class="px-5 py-4 text-slate-600">
                ${escapeHTML(item.citation || "—")}
            </td>

            <td class="px-5 py-4 text-slate-600">
                ${escapeHTML(item.decision_year || "—")}
            </td>

            <td class="px-5 py-4">
                ${getStatusBadge(item.status)}
            </td>

            <td class="px-5 py-4">
                <div class="flex flex-wrap gap-2">

                    <button
                        data-action="edit"
                        data-id="${escapeHTML(item.id)}"
                        class="bg-blue-50 text-blue-700 px-3 py-2 rounded text-xs">
                        Edit
                    </button>
                    <button
    data-action="relations"
    data-id="${escapeHTML(item.id)}"
    class="text-purple-700 hover:text-purple-900 text-sm font-medium">
    Manage Relations
</button>

                    ${
                      item.status === "draft"
                        ? `
                        <button data-action="publish"
                            data-id="${escapeHTML(item.id)}"
                            class="bg-green-50 text-green-700 px-3 py-2 rounded text-xs">
                            Publish
                        </button>
                    `
                        : ""
                    }

                    ${
                      item.status === "published"
                        ? `
                        <button data-action="unpublish"
                            data-id="${escapeHTML(item.id)}"
                            class="bg-amber-50 text-amber-700 px-3 py-2 rounded text-xs">
                            Unpublish
                        </button>
                    `
                        : ""
                    }

                    ${
                      item.status !== "archived"
                        ? `
                        <button data-action="archive"
                            data-id="${escapeHTML(item.id)}"
                            class="bg-red-50 text-red-700 px-3 py-2 rounded text-xs">
                            Archive
                        </button>
                    `
                        : ""
                    }

                    ${
                      item.status === "archived"
                        ? `
                        <button data-action="restore"
                            data-id="${escapeHTML(item.id)}"
                            class="bg-green-50 text-green-700 px-3 py-2 rounded text-xs">
                            Restore
                        </button>
                    `
                        : ""
                    }

                </div>
            </td>

        </tr>
    `,
    )
    .join("");
}

async function loadCases() {
  casesTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="px-5 py-10 text-center text-slate-500">
                Loading cases...
            </td>
        </tr>
    `;

  try {
    const search = document.getElementById("searchCasesInput").value.trim();
    const status = document.getElementById("statusFilter").value;

    const params = new URLSearchParams({
      page: "1",
      limit: "100",
    });

    if (search) params.set("search", search);
    if (status) params.set("status", status);

    const response = await apiRequest(`/admin/cases?${params.toString()}`);

    if (!response.success) {
      throw new Error(response.message || "Unable to load cases.");
    }

    renderCases(response.cases || []);
  } catch (error) {
    console.error("Case Loading Error:", error);

    casesTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-5 py-10 text-center text-red-600">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
  }
}

function openCreateForm() {
  caseForm.reset();

  document.getElementById("caseId").value = "";
  document.getElementById("formTitle").textContent = "Add New Case";
  saveCaseButton.textContent = "Save Case";

  caseFormSection.classList.remove("hidden");
  caseFormSection.scrollIntoView({ behavior: "smooth" });
}

function openEditForm(id) {
  const item = currentCases.find((record) => String(record.id) === String(id));

  if (!item) {
    showCaseMessage("Case record not found.");
    return;
  }

  document.getElementById("caseId").value = item.id;
  document.getElementById("title").value = item.title || "";
  document.getElementById("caseNumber").value = item.case_number || "";
  document.getElementById("citation").value = item.citation || "";
  document.getElementById("petitioner").value = item.petitioner || "";
  document.getElementById("respondent").value = item.respondent || "";
  document.getElementById("courtId").value = item.court_id || "";
  document.getElementById("decisionYear").value = item.decision_year || "";
  document.getElementById("decisionDate").value = item.decision_date
    ? String(item.decision_date).slice(0, 10)
    : "";
  document.getElementById("sourceUrl").value = item.source_url || "";
  document.getElementById("judgmentText").value = item.judgment_text || "";

  document.getElementById("formTitle").textContent = "Edit Case";
  saveCaseButton.textContent = "Update Case";

  caseFormSection.classList.remove("hidden");
  caseFormSection.scrollIntoView({ behavior: "smooth" });
}

function getCaseFormData() {
  const data = {
    title: document.getElementById("title").value.trim(),
    case_number: document.getElementById("caseNumber").value.trim() || null,
    citation: document.getElementById("citation").value.trim() || null,
    petitioner: document.getElementById("petitioner").value.trim() || null,
    respondent: document.getElementById("respondent").value.trim() || null,
    court_id: document.getElementById("courtId").value
      ? Number(document.getElementById("courtId").value)
      : null,
    decision_year: document.getElementById("decisionYear").value
      ? Number(document.getElementById("decisionYear").value)
      : null,
    decision_date: document.getElementById("decisionDate").value || null,
    source_url: document.getElementById("sourceUrl").value.trim() || null,
    judgment_text: document.getElementById("judgmentText").value.trim() || null,
  };

  return data;
}

caseForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const id = document.getElementById("caseId").value;
  const data = getCaseFormData();

  if (!data.title) {
    showCaseMessage("Case title is required.");
    return;
  }

  saveCaseButton.disabled = true;
  saveCaseButton.textContent = "Saving...";

  try {
    let response;

    if (id) {
      response = await apiRequest(`/admin/cases/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    } else {
      response = await apiRequest("/admin/cases", {
        method: "POST",
        body: JSON.stringify(data),
      });
    }

    if (!response.success) {
      throw new Error(response.message || "Unable to save case.");
    }

    caseFormSection.classList.add("hidden");
    caseForm.reset();

    showCaseMessage(
      id ? "Case updated successfully." : "Case created successfully.",
      "success",
    );

    await loadCases();
  } catch (error) {
    showCaseMessage(error.message || "Unable to save case.");
  } finally {
    saveCaseButton.disabled = false;
    saveCaseButton.textContent = id ? "Update Case" : "Save Case";
  }
});


casesTableBody.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!id) return;

    // Edit Case
    if (action === "edit") {
        openEditForm(id);
        return;
    }

    // Manage Case Relations
    if (action === "relations") {
        window.location.href =
            `./admin-case-relations.html?caseId=${encodeURIComponent(id)}`;

        return;
    }

    // Publish, Unpublish, Archive, Restore
    const actionLabels = {
        publish: "publish",
        unpublish: "unpublish",
        archive: "archive",
        restore: "restore",
    };

    const label = actionLabels[action];

    if (!label) return;

    if (!window.confirm(`Are you sure you want to ${label} this case?`)) {
        return;
    }

    button.disabled = true;

    try {
        const response = await apiRequest(
            `/admin/cases/${encodeURIComponent(id)}/${action}`,
            { method: "POST" }
        );

        if (!response.success) {
            throw new Error(response.message || `Unable to ${label} case.`);
        }

        showCaseMessage(
            `Case ${label} action completed successfully.`,
            "success"
        );

        await loadCases();

    } catch (error) {
        showCaseMessage(error.message || `Unable to ${label} case.`);
        button.disabled = false;
    }
});


document
  .getElementById("showCreateForm")
  .addEventListener("click", openCreateForm);

document
  .getElementById("closeCaseForm")
  .addEventListener("click", () => caseFormSection.classList.add("hidden"));

document
  .getElementById("cancelCaseForm")
  .addEventListener("click", () => caseFormSection.classList.add("hidden"));

document.getElementById("refreshCases").addEventListener("click", loadCases);

document.getElementById("statusFilter").addEventListener("change", loadCases);

let searchTimeout;

document.getElementById("searchCasesInput").addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(loadCases, 400);
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await AuthAPI.logout();
    window.location.href = "./login.html";
  } catch (error) {
    showCaseMessage(error.message || "Logout failed.");
  }
});

async function initializeCaseManagement() {
  try {
    const response = await AuthAPI.getCurrentUser();

    if (!response.success || !response.user) {
      window.location.href = "./login.html";
      return;
    }

    if (!["admin", "editor"].includes(response.user.role)) {
      window.location.href = "./index.html";
      return;
    }

    await loadCases();
  } catch (error) {
    window.location.href = "./login.html";
  }
}

document.addEventListener("DOMContentLoaded", initializeCaseManagement);

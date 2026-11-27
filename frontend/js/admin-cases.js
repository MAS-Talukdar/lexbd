const caseForm = document.getElementById("caseForm");
const caseFormSection = document.getElementById("caseFormSection");
const casesTableBody = document.getElementById("casesTableBody");
const caseMessage = document.getElementById("caseMessage");
const saveCaseButton = document.getElementById("saveCaseButton");

const legalSubjectSelect = document.getElementById("legalSubject");
const legalTopicsContainer = document.getElementById("legalTopicsContainer");
const selectedTopicsCount = document.getElementById("selectedTopicsCount");
const judgmentTextField = document.getElementById("judgmentText");
const judgmentWordCount = document.getElementById("judgmentWordCount");

let currentCases = [];
let legalTopics = [];
let quillEditor = null;
let currentRelations = {
  judges: [],
  topics: [],
  legislation: [],
};

document.getElementById("currentYear").textContent = new Date().getFullYear();

// =====================================
// JUDGMENT EDITOR INITIALIZATION
// =====================================

function initializeJudgmentEditor() {
  if (typeof Quill === "undefined") {
    throw new Error("Judgment Editor library could not be loaded.");
  }

  if (quillEditor) return;

  quillEditor = new Quill("#judgmentEditor", {
    theme: "snow",
    modules: {
      toolbar: "#judgmentToolbar",
    },
    placeholder: "Enter the full judgment text...",
  });

  quillEditor.on("text-change", syncJudgmentText);

  syncJudgmentText();
}

function syncJudgmentText() {
  if (!quillEditor) return;

  const html = quillEditor.getSemanticHTML();

  judgmentTextField.value = quillEditor.getText().trim().length > 0 ? html : "";

  const text = quillEditor.getText().trim();

  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  judgmentWordCount.textContent = `${words} words`;
}

function setJudgmentText(value) {
  if (!quillEditor) return;

  const content = String(value ?? "");

  quillEditor.setText("");

  if (content.trim()) {
    quillEditor.clipboard.dangerouslyPasteHTML(content);
  }

  syncJudgmentText();
}

// =====================================
// MESSAGE
// =====================================

function showCaseMessage(message, type = "error") {
  caseMessage.textContent = message;
  caseMessage.className = "rounded-lg p-4 mb-6 text-sm";

  caseMessage.classList.add(
    type === "success" ? "bg-green-50" : "bg-red-50",
    type === "success" ? "text-green-700" : "text-red-700",
  );
}

// =====================================
// HTML ESCAPE
// =====================================

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

// =====================================
// STATUS BADGE
// =====================================

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

// =====================================
// LEGAL CLASSIFICATION
// =====================================

async function loadLegalTopics() {
  const response = await apiRequest("/admin/cases/topics");

  if (!response.success) {
    throw new Error(response.message || "Could not load legal classification.");
  }

  legalTopics = Array.isArray(response.topics) ? response.topics : [];

  renderLegalSubjects();
}

function getLegalSubjects() {
  return legalTopics.filter(
    (item) => item.parent_id === null || item.parent_id === undefined,
  );
}

function getTopicsForSubject(subjectId) {
  return legalTopics.filter(
    (item) => Number(item.parent_id) === Number(subjectId),
  );
}

function renderLegalSubjects(selectedSubjectId = "") {
  const subjects = getLegalSubjects();

  legalSubjectSelect.innerHTML = `
    <option value="">Select a legal subject</option>
    ${subjects
      .map(
        (subject) => `
      <option value="${escapeHTML(subject.id)}">
        ${escapeHTML(subject.name)}
      </option>
    `,
      )
      .join("")}
  `;

  legalSubjectSelect.value = selectedSubjectId ? String(selectedSubjectId) : "";

  renderLegalTopics();
}

function renderLegalTopics(selectedTopicIds = []) {
  const subjectId = legalSubjectSelect.value;

  const selectedIds = new Set(selectedTopicIds.map(Number));

  if (!subjectId) {
    legalTopicsContainer.innerHTML = `
      <p class="text-sm text-slate-500">
        Select a legal subject to view its topics.
      </p>
    `;

    updateSelectedTopicsCount();
    return;
  }

  const topics = getTopicsForSubject(subjectId);

  if (!topics.length) {
    legalTopicsContainer.innerHTML = `
      <p class="text-sm text-slate-500">
        No topics are available under this subject yet.
      </p>
    `;

    updateSelectedTopicsCount();
    return;
  }

  legalTopicsContainer.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${topics
        .map(
          (topic) => `
        <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            class="topic-checkbox"
            name="legalTopic"
            value="${escapeHTML(topic.id)}"
            ${selectedIds.has(Number(topic.id)) ? "checked" : ""}
          >

          <span>${escapeHTML(topic.name)}</span>
        </label>
      `,
        )
        .join("")}
    </div>
  `;

  updateSelectedTopicsCount();
}

function getSelectedTopicIds() {
  const subjectId = legalSubjectSelect.value;

  if (!subjectId) return [];

  // Store the parent Subject ID together with selected child Topic IDs.
  const selectedIds = [
    Number(subjectId),
    ...Array.from(
      legalTopicsContainer.querySelectorAll('input[name="legalTopic"]:checked'),
    ).map((input) => Number(input.value)),
  ];

  return [...new Set(selectedIds)];
}

function updateSelectedTopicsCount() {
  const count = legalTopicsContainer.querySelectorAll(
    'input[name="legalTopic"]:checked',
  ).length;

  selectedTopicsCount.textContent = `${count} selected`;
}

function resetClassification() {
  legalSubjectSelect.value = "";
  renderLegalTopics();
}

function loadCaseClassification(topicIds = []) {
  const ids = topicIds.map(Number);

  let subjectId = null;

  // First, check whether the parent Subject ID is already linked.
  const selectedSubject = legalTopics.find(
    (item) =>
      (item.parent_id === null || item.parent_id === undefined) &&
      ids.includes(Number(item.id)),
  );

  if (selectedSubject) {
    subjectId = Number(selectedSubject.id);
  } else {
    // Otherwise, identify the Subject from a selected child Topic.
    const selectedChild = legalTopics.find(
      (item) =>
        item.parent_id !== null &&
        item.parent_id !== undefined &&
        ids.includes(Number(item.id)),
    );

    if (selectedChild) {
      subjectId = Number(selectedChild.parent_id);
    }
  }

  if (!subjectId) {
    resetClassification();
    return;
  }

  const selectedChildIds = ids.filter((id) => {
    const topic = legalTopics.find((item) => Number(item.id) === id);

    return topic && Number(topic.parent_id) === subjectId;
  });

  legalSubjectSelect.value = String(subjectId);

  renderLegalTopics(selectedChildIds);
}

legalSubjectSelect.addEventListener("change", () => {
  renderLegalTopics();
});

legalTopicsContainer.addEventListener("change", (event) => {
  if (event.target.matches('input[name="legalTopic"]')) {
    updateSelectedTopicsCount();
  }
});

// =====================================
// RENDER CASES
// =====================================

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
                  <button
                    data-action="publish"
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
                  <button
                    data-action="unpublish"
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
                  <button
                    data-action="archive"
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
                  <button
                    data-action="restore"
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

// =====================================
// LOAD CASE LIST
// =====================================

async function loadCases() {
  casesTableBody.innerHTML = `
    <tr>
      <td colspan="5"
          class="px-5 py-10 text-center text-slate-500">
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
        <td colspan="5"
            class="px-5 py-10 text-center text-red-600">
          ${escapeHTML(error.message)}
        </td>
      </tr>
    `;
  }
}

// =====================================
// OPEN CREATE FORM
// =====================================

function openCreateForm() {
  caseForm.reset();

  document.getElementById("caseId").value = "";

  currentRelations = {
    judges: [],
    topics: [],
    legislation: [],
  };

  document.getElementById("formTitle").textContent = "Add New Case";

  saveCaseButton.disabled = false;
  saveCaseButton.textContent = "Save Case";

  resetClassification();
  setJudgmentText("");

  caseFormSection.classList.remove("hidden");

  caseFormSection.scrollIntoView({
    behavior: "smooth",
  });
}

// =====================================
// OPEN EDIT FORM
// =====================================

async function openEditForm(id) {
  const item = currentCases.find((record) => String(record.id) === String(id));

  if (!item) {
    showCaseMessage("Case record not found.");
    return;
  }

  saveCaseButton.disabled = true;
  saveCaseButton.textContent = "Loading Case...";

  try {
    const [response, relationsResponse] = await Promise.all([
      apiRequest(`/admin/cases/${encodeURIComponent(id)}`),
      apiRequest(`/admin/cases/${encodeURIComponent(id)}/relations`),
    ]);

    if (!response.success || !response.case) {
      throw new Error(
        response.message || "Complete case details could not be loaded.",
      );
    }

    if (!relationsResponse.success || !relationsResponse.relations) {
      throw new Error(
        relationsResponse.message || "Case classification could not be loaded.",
      );
    }

    const caseData = response.case;
    const relations = relationsResponse.relations;

    currentRelations = {
      judges: relations.judges || [],
      topics: relations.topics || [],
      legislation: relations.legislation || [],
    };

    document.getElementById("caseId").value = caseData.id;

    document.getElementById("title").value = caseData.title || "";

    document.getElementById("caseNumber").value = caseData.case_number || "";

    document.getElementById("citation").value = caseData.citation || "";

    document.getElementById("petitioner").value = caseData.petitioner || "";

    document.getElementById("respondent").value = caseData.respondent || "";

    document.getElementById("courtId").value = caseData.court_id ?? "";

    document.getElementById("decisionYear").value =
      caseData.decision_year ?? "";

    document.getElementById("decisionDate").value = caseData.decision_date
      ? String(caseData.decision_date).slice(0, 10)
      : "";

    document.getElementById("sourceUrl").value = caseData.source_url || "";

    setJudgmentText(caseData.judgment_text ?? "");

    loadCaseClassification(currentRelations.topics);

    document.getElementById("formTitle").textContent = "Edit Case";

    saveCaseButton.textContent = "Update Case";

    caseFormSection.classList.remove("hidden");

    caseFormSection.scrollIntoView({
      behavior: "smooth",
    });
  } catch (error) {
    console.error("Case Details Loading Error:", error);

    showCaseMessage(error.message || "Unable to load complete case details.");
  } finally {
    saveCaseButton.disabled = false;

    saveCaseButton.textContent = "Update Case";
  }
}

// =====================================
// GET FORM DATA
// =====================================

function getCaseFormData() {
  syncJudgmentText();

  return {
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

    judgment_text: judgmentTextField.value.trim() || null,
  };
}

// =====================================
// SAVE CASE RELATIONSHIPS
// =====================================

async function saveCaseRelationships(caseId) {
  const existing = currentRelations || {
    judges: [],
    topics: [],
    legislation: [],
  };

  const response = await apiRequest(
    `/admin/cases/${encodeURIComponent(caseId)}/relations`,
    {
      method: "PUT",
      body: JSON.stringify({
        judge_ids: existing.judges || [],
        topic_ids: getSelectedTopicIds(),
        legislation: existing.legislation || [],
      }),
    },
  );

  if (!response.success) {
    throw new Error(
      response.message || "Case classification could not be saved.",
    );
  }
}

// =====================================
// SAVE / UPDATE CASE
// =====================================

caseForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const id = document.getElementById("caseId").value;
  const data = getCaseFormData();

  if (!data.title) {
    showCaseMessage("Case title is required.");
    return;
  }

  if (!legalSubjectSelect.value) {
    showCaseMessage("Please select a Primary Legal Subject.");
    legalSubjectSelect.focus();
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

    const savedCaseId = response.case?.id || id;

    if (!savedCaseId) {
      throw new Error(
        "Case was saved, but the server did not return its ID. Classification was not saved.",
      );
    }

    await saveCaseRelationships(savedCaseId);

    caseFormSection.classList.add("hidden");

    caseForm.reset();

    setJudgmentText("");
    resetClassification();

    currentRelations = {
      judges: [],
      topics: [],
      legislation: [],
    };

    showCaseMessage(
      id
        ? "Case and classification updated successfully."
        : "Case and classification created successfully.",
      "success",
    );

    await loadCases();
  } catch (error) {
    console.error("Case Save Error:", error);

    showCaseMessage(error.message || "Unable to save case.");
  } finally {
    saveCaseButton.disabled = false;

    saveCaseButton.textContent = id ? "Update Case" : "Save Case";
  }
});

// =====================================
// CASE TABLE ACTIONS
// =====================================

casesTableBody.addEventListener("click", async function (event) {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (!id) return;

  if (action === "edit") {
    await openEditForm(id);
    return;
  }

  if (action === "relations") {
    window.location.href = `./admin-case-relations.html?caseId=${encodeURIComponent(id)}`;

    return;
  }

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
      {
        method: "POST",
      },
    );

    if (!response.success) {
      throw new Error(response.message || `Unable to ${label} case.`);
    }

    showCaseMessage(`Case ${label} action completed successfully.`, "success");

    await loadCases();
  } catch (error) {
    showCaseMessage(error.message || `Unable to ${label} case.`);

    button.disabled = false;
  }
});

// =====================================
// FORM BUTTONS
// =====================================

document
  .getElementById("showCreateForm")
  .addEventListener("click", openCreateForm);

document.getElementById("closeCaseForm").addEventListener("click", () => {
  caseFormSection.classList.add("hidden");
});

document.getElementById("cancelCaseForm").addEventListener("click", () => {
  caseFormSection.classList.add("hidden");
});

// =====================================
// SEARCH / FILTER / REFRESH
// =====================================

document.getElementById("refreshCases").addEventListener("click", loadCases);

document.getElementById("statusFilter").addEventListener("change", loadCases);

let searchTimeout;

document.getElementById("searchCasesInput").addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(loadCases, 400);
});

// =====================================
// LOGOUT
// =====================================

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await AuthAPI.logout();

    window.location.href = "./login.html";
  } catch (error) {
    showCaseMessage(error.message || "Logout failed.");
  }
});

// =====================================
// INITIALIZE CASE MANAGEMENT
// =====================================

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

    initializeJudgmentEditor();

    await loadLegalTopics();

    await loadCases();
  } catch (error) {
    console.error("Case Management Initialization Error:", error);

    showCaseMessage(error.message || "Could not initialize Case Management.");
  }
}

document.addEventListener("DOMContentLoaded", initializeCaseManagement);

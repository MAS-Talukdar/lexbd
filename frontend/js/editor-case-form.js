const API_BASE_URL = "/api";

const caseForm = document.getElementById("caseForm");
const messageBox = document.getElementById("message");
const saveButton = document.getElementById("saveButton");

const subjectSelect = document.getElementById("legal_subject");
const topicsSelect = document.getElementById("legal_topics");
const judgmentTextarea = document.getElementById("judgment_text");

const params = new URLSearchParams(window.location.search);
const caseId = params.get("id");

let quill = null;
let allTopics = [];
let currentRelations = {
  judges: [],
  topics: [],
  legislation: [],
};

const fields = [
  "title",
  "case_number",
  "petitioner",
  "respondent",
  "citation",
  "court_id",
  "decision_year",
  "decision_date",
  "pdf_url",
  "source_url",
];

// =====================================
// API REQUEST
// =====================================

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// =====================================
// MESSAGE
// =====================================

function showMessage(message, type = "error") {
  messageBox.textContent = message;

  messageBox.className =
    "mb-5 p-3 rounded-lg text-sm " +
    (type === "success"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700");
}

// =====================================
// EDITOR INITIALIZATION
// =====================================

function initializeJudgmentEditor() {
  if (typeof Quill === "undefined") {
    throw new Error("Judgment Editor could not be loaded.");
  }

  quill = new Quill("#judgmentEditor", {
    theme: "snow",

    modules: {
      toolbar: "#judgmentToolbar",
    },

    placeholder: "Write or paste the judgment text here...",
  });

  quill.on("text-change", updateWordCount);

  updateWordCount();
}

function updateWordCount() {
  if (!quill) return;

  const text = quill.getText().trim();

  const wordCount = text ? text.split(/\s+/).length : 0;

  const counter = document.getElementById("judgmentWordCount");

  if (counter) {
    counter.textContent = `${wordCount} words`;
  }
}

function setJudgmentText(value) {
  if (!quill) return;

  const content = value || "";

  // Existing formatted HTML
  if (/<[a-z][\s\S]*>/i.test(content)) {
    quill.clipboard.dangerouslyPasteHTML(content);
  } else {
    // Existing plain text
    quill.setText(content);
  }

  updateWordCount();
}

function getJudgmentText() {
  if (!quill) return "";

  return quill.root.innerHTML;
}

// =====================================
// LEGAL CLASSIFICATION
// =====================================

async function loadLegalTopics() {
  const data = await apiRequest("/admin/cases/topics");

  allTopics = data.topics || [];

  subjectSelect.innerHTML = '<option value="">Select Primary Subject</option>';

  const subjects = allTopics.filter((topic) => topic.parent_id === null);

  subjects.forEach((subject) => {
    const option = document.createElement("option");

    option.value = subject.id;
    option.textContent = subject.name;

    subjectSelect.appendChild(option);
  });

  subjectSelect.addEventListener("change", function () {
    populateLegalTopics(this.value, []);
  });
}

function populateLegalTopics(subjectId, selectedTopicIds = []) {
  topicsSelect.innerHTML = "";

  if (!subjectId) {
    const option = document.createElement("option");

    option.textContent = "Select a Primary Subject first";
    option.disabled = true;

    topicsSelect.appendChild(option);

    return;
  }

  const childTopics = allTopics.filter(
    (topic) => String(topic.parent_id) === String(subjectId),
  );

  if (childTopics.length === 0) {
    const option = document.createElement("option");

    option.textContent = "No topics available under this subject";
    option.disabled = true;

    topicsSelect.appendChild(option);

    return;
  }

  childTopics.forEach((topic) => {
    const option = document.createElement("option");

    option.value = topic.id;
    option.textContent = topic.name;

    option.selected = selectedTopicIds.some(
      (id) => String(id) === String(topic.id),
    );

    topicsSelect.appendChild(option);
  });
}

function getSelectedTopicIds() {
  const subjectId = subjectSelect.value;

  const selectedChildIds = Array.from(topicsSelect.selectedOptions)
    .map((option) => Number(option.value))
    .filter(Number.isSafeInteger);

  // Store the Primary Subject and its child Topics
  // in the existing case_topics relationship.

  return subjectId
    ? [Number(subjectId), ...selectedChildIds]
    : selectedChildIds;
}

// =====================================
// AUTHENTICATION
// =====================================

async function checkEditorAccess() {
  try {
    const data = await apiRequest("/auth/me");

    if (!data.authenticated || !data.user) {
      window.location.href = "./login.html";
      return false;
    }

    if (data.user.role === "admin") {
      window.location.href = "./admin-dashboard.html";
      return false;
    }

    if (data.user.role !== "editor") {
      window.location.href = "./login.html";
      return false;
    }

    return true;
  } catch (error) {
    window.location.href = "./login.html";
    return false;
  }
}

// =====================================
// LOAD CASE RELATIONSHIPS
// =====================================

async function loadCaseRelations(id) {
  const data = await apiRequest(`/admin/cases/${id}/relations`);

  const relations = data.relations || {};

  currentRelations = {
    judges: relations.judges || [],
    topics: relations.topics || [],
    legislation: relations.legislation || [],
  };

  const selectedIds = currentRelations.topics;

  // Find the selected Primary Subject.
  const primarySubject = selectedIds.find((id) =>
    allTopics.some(
      (topic) => String(topic.id) === String(id) && topic.parent_id === null,
    ),
  );

  if (primarySubject) {
    subjectSelect.value = primarySubject;

    const childTopicIds = selectedIds.filter((id) =>
      allTopics.some(
        (topic) =>
          String(topic.id) === String(id) &&
          String(topic.parent_id) === String(primarySubject),
      ),
    );

    populateLegalTopics(primarySubject, childTopicIds);
  } else {
    subjectSelect.value = "";
    populateLegalTopics("", []);
  }
}

// =====================================
// LOAD EXISTING CASE
// =====================================

async function loadCase() {
  if (!caseId) return;

  try {
    const data = await apiRequest(`/admin/cases/${caseId}`);

    const caseData = data.case;

    if (!caseData) {
      throw new Error("Case information not found.");
    }

    fields.forEach((field) => {
      const input = document.getElementById(field);

      if (!input) return;

      let value = caseData[field] ?? "";

      if (field === "decision_date" && value) {
        value = String(value).slice(0, 10);
      }

      input.value = value;
    });

    setJudgmentText(caseData.judgment_text);

    await loadCaseRelations(caseId);

    document.getElementById("formTitle").textContent = "Edit Case";

    saveButton.textContent = "Update Case";
  } catch (error) {
    showMessage(error.message);
    saveButton.disabled = true;
  }
}

// =====================================
// GET CASE FORM DATA
// =====================================

function getCasePayload() {
  const payload = {};

  fields.forEach((field) => {
    const input = document.getElementById(field);

    if (!input) return;

    const value = input.value.trim();

    if (field === "court_id" || field === "decision_year") {
      payload[field] = value === "" ? null : Number(value);
    } else {
      payload[field] = value === "" ? null : value;
    }
  });

  payload.judgment_text = getJudgmentText();

  return payload;
}

// =====================================
// SAVE CASE RELATIONSHIPS
// =====================================

async function saveCaseRelations(id) {
  const topicIds = getSelectedTopicIds();

  await apiRequest(`/admin/cases/${id}/relations`, {
    method: "PUT",

    body: JSON.stringify({
      judge_ids: currentRelations.judges,
      topic_ids: topicIds,
      legislation: currentRelations.legislation,
    }),
  });
}

// =====================================
// FORM SUBMISSION
// =====================================

caseForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const payload = getCasePayload();

  if (!payload.title) {
    showMessage("Case title is required.");
    return;
  }

  if (!quill || !quill.getText().trim()) {
    showMessage("Judgment text is required.");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const endpoint = caseId ? `/admin/cases/${caseId}` : "/admin/cases";

    const method = caseId ? "PATCH" : "POST";

    const data = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    if (!data.success) {
      throw new Error(data.message || "Could not save case.");
    }

    const savedCaseId = caseId || data.case?.id;

    if (!savedCaseId) {
      throw new Error("Case was saved, but its ID could not be retrieved.");
    }

    await saveCaseRelations(savedCaseId);

    showMessage("Case and classification saved successfully.", "success");

    saveButton.textContent = "Saved";

    setTimeout(() => {
      window.location.href = "./editor-dashboard.html";
    }, 1200);
  } catch (error) {
    showMessage(error.message);

    saveButton.disabled = false;

    saveButton.textContent = caseId ? "Update Case" : "Save Draft";
  }
});

// =====================================
// INITIALIZE FORM
// =====================================

async function initializeForm() {
  const authorized = await checkEditorAccess();

  if (!authorized) return;

  try {
    initializeJudgmentEditor();

    await loadLegalTopics();

    if (caseId) {
      await loadCase();
    }
  } catch (error) {
    showMessage(error.message);
    saveButton.disabled = true;
  }
}

initializeForm();

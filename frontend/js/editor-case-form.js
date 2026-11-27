
const API_BASE_URL = "/api";

// ============================================
// ELEMENTS & STATE
// ============================================

const form = document.getElementById("caseForm");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("message");

const subjectSelect = document.getElementById("legal_subject");
const topicsContainer = document.getElementById("legalTopicsContainer");
const selectedTopicsCount = document.getElementById("selectedTopicsCount");

const judgmentTextarea = document.getElementById("judgment_text");
const wordCountElement = document.getElementById("judgmentWordCount");

const params = new URLSearchParams(window.location.search);
const caseId = params.get("caseId") || params.get("id");

let quill = null;
let allTopics = [];
let currentRelations = {
    judges: [],
    legislation: []
};

// ============================================
// API HELPER
// ============================================

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: "include",
        ...options,
        headers: {
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();

    let data;

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error(
            `Invalid server response (${response.status}). ` +
            "The server did not return valid JSON."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}

// ============================================
// MESSAGE
// ============================================

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.classList.remove(
        "hidden",
        "bg-green-100",
        "text-green-800",
        "bg-red-100",
        "text-red-800",
        "bg-blue-100",
        "text-blue-800"
    );

    if (type === "success") {
        messageBox.classList.add("bg-green-100", "text-green-800");
    } else if (type === "error") {
        messageBox.classList.add("bg-red-100", "text-red-800");
    } else {
        messageBox.classList.add("bg-blue-100", "text-blue-800");
    }
}

function hideMessage() {
    messageBox.classList.add("hidden");
}

// ============================================
// QUILL JUDGMENT EDITOR
// ============================================

function initializeJudgmentEditor() {
    if (typeof Quill === "undefined") {
        throw new Error("Quill Editor could not be loaded.");
    }

    quill = new Quill("#judgmentEditor", {
        theme: "snow",

        modules: {
            toolbar: "#judgmentToolbar"
        },

        placeholder: "Write or paste the judgment text here..."
    });

    quill.on("text-change", updateWordCount);
    quill.on("text-change", syncJudgmentText);

    updateWordCount();
    syncJudgmentText();
}

function syncJudgmentText() {
    if (!quill) return;

    judgmentTextarea.value = quill.root.innerHTML;
}

function setJudgmentText(value) {
    if (!quill) return;

    if (!value) {
        quill.setText("");
    } else {
        quill.clipboard.dangerouslyPasteHTML(value);
    }

    syncJudgmentText();
    updateWordCount();
}

function updateWordCount() {
    if (!quill) return;

    const text = quill.getText().trim();

    const words = text
        ? text.split(/\s+/).filter(Boolean).length
        : 0;

    wordCountElement.textContent = `${words} words`;
}

// ============================================
// LOAD LEGAL SUBJECTS & TOPICS
// ============================================

async function loadLegalTopics() {
    const data = await apiRequest("/admin/cases/topics");

    allTopics = data.topics || [];

    const subjects = allTopics.filter(
        topic => topic.parent_id === null
    );

    subjectSelect.innerHTML = `
        <option value="">Select Primary Legal Subject</option>
    `;

    subjects.forEach(subject => {
        const option = document.createElement("option");

        option.value = subject.id;
        option.textContent = subject.name;

        subjectSelect.appendChild(option);
    });

    if (subjects.length === 0) {
        subjectSelect.innerHTML = `
            <option value="">No Legal Subjects available</option>
        `;

        renderTopicsMessage(
            "No Legal Subjects found. Add subjects to the legal_topics database first."
        );
    }
}

function renderTopicsMessage(message) {
    topicsContainer.innerHTML = "";

    const paragraph = document.createElement("p");
    paragraph.className = "text-sm text-gray-500";
    paragraph.textContent = message;

    topicsContainer.appendChild(paragraph);

    updateSelectedTopicsCount();
}

// ============================================
// DISPLAY TOPIC CHECKBOXES
// ============================================

function renderLegalTopics(subjectId, selectedIds = []) {
    topicsContainer.innerHTML = "";

    if (!subjectId) {
        renderTopicsMessage(
            "Select a Primary Legal Subject first."
        );
        return;
    }

    const childTopics = allTopics.filter(
        topic => String(topic.parent_id) === String(subjectId)
    );

    if (childTopics.length === 0) {
        renderTopicsMessage(
            "No Legal Topics are available under this subject."
        );
        return;
    }

    childTopics.forEach(topic => {
        const label = document.createElement("label");

        label.className = "topic-option";

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.name = "legal_topic_ids";
        checkbox.value = topic.id;
        checkbox.checked = selectedIds.some(
            id => String(id) === String(topic.id)
        );

        checkbox.addEventListener(
            "change",
            updateSelectedTopicsCount
        );

        const text = document.createElement("span");

        text.className = "text-sm text-slate-700";
        text.textContent = topic.name;

        label.appendChild(checkbox);
        label.appendChild(text);

        topicsContainer.appendChild(label);
    });

    updateSelectedTopicsCount();
}

function getSelectedTopicIds() {
    const subjectId = subjectSelect.value;

    if (!subjectId) return [];

    const selectedChildren = Array.from(
        topicsContainer.querySelectorAll(
            'input[name="legal_topic_ids"]:checked'
        )
    ).map(input => Number(input.value));

    // Save both the Primary Subject and selected child Topics.
    return [
        Number(subjectId),
        ...selectedChildren
    ];
}

function updateSelectedTopicsCount() {
    const selected = topicsContainer.querySelectorAll(
        'input[name="legal_topic_ids"]:checked'
    );

    selectedTopicsCount.textContent =
        `${selected.length} topics selected`;
}

// ============================================
// SUBJECT CHANGE
// ============================================

subjectSelect.addEventListener("change", () => {
    renderLegalTopics(subjectSelect.value);
});

// ============================================
// FORM FIELD HELPERS
// ============================================

function setFieldValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}

function getFieldValue(id) {
    const element = document.getElementById(id);

    return element ? element.value.trim() : "";
}

function getNumberOrNull(value) {
    if (!value) return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

// ============================================
// AUTHENTICATION
// ============================================

async function checkAuthentication() {
    const data = await apiRequest("/auth/me");

    const user = data.user || data;

    if (data.success === false || !user) {
        window.location.href = "./login.html";
        return false;
    }

    const role = user.role;

    if (role && !["admin", "editor"].includes(role)) {
        window.location.href = "./login.html";
        return false;
    }

    return true;
}

// ============================================
// LOAD CASE RELATIONS
// ============================================

async function loadCaseRelations(id) {
    const data = await apiRequest(
        `/admin/cases/${id}/relations`
    );

    const relations = data.relations || {};

    currentRelations = {
        judges: relations.judges || [],
        legislation: relations.legislation || []
    };

    const savedTopicIds = (relations.topics || []).map(Number);

    const subject = allTopics.find(topic =>
        topic.parent_id === null &&
        savedTopicIds.includes(Number(topic.id))
    );

    if (subject) {
        subjectSelect.value = subject.id;

        const childIds = savedTopicIds.filter(topicId => {
            const topic = allTopics.find(
                item => Number(item.id) === topicId
            );

            return topic &&
                String(topic.parent_id) === String(subject.id);
        });

        renderLegalTopics(subject.id, childIds);
    } else {
        subjectSelect.value = "";

        renderTopicsMessage(
            "No Primary Legal Subject is assigned to this case."
        );
    }
}

// ============================================
// LOAD EXISTING CASE
// ============================================

async function loadExistingCase() {
    const data = await apiRequest(
        `/admin/cases/${caseId}`
    );

    const caseData = data.case || data;

    document.getElementById("formTitle").textContent =
        "Edit Case";

    saveButton.textContent = "Update Draft";

    setFieldValue("title", caseData.title);
    setFieldValue("case_number", caseData.case_number);
    setFieldValue("citation", caseData.citation);
    setFieldValue("petitioner", caseData.petitioner);
    setFieldValue("respondent", caseData.respondent);
    setFieldValue("court_id", caseData.court_id);
    setFieldValue("decision_year", caseData.decision_year);
    setFieldValue("decision_date", caseData.decision_date);
    setFieldValue("pdf_url", caseData.pdf_url);
    setFieldValue("source_url", caseData.source_url);

    setJudgmentText(caseData.judgment_text || "");

    await loadCaseRelations(caseId);
}

// ============================================
// BUILD CASE PAYLOAD
// ============================================

function buildCasePayload() {
    syncJudgmentText();

    return {
        title: getFieldValue("title"),
        case_number: getFieldValue("case_number") || null,
        citation: getFieldValue("citation") || null,
        petitioner: getFieldValue("petitioner") || null,
        respondent: getFieldValue("respondent") || null,

        court_id: getNumberOrNull(
            getFieldValue("court_id")
        ),

        decision_year: getNumberOrNull(
            getFieldValue("decision_year")
        ),

        decision_date: getFieldValue("decision_date") || null,

        judgment_text: judgmentTextarea.value,

        pdf_url: getFieldValue("pdf_url") || null,
        source_url: getFieldValue("source_url") || null
    };
}

// ============================================
// SAVE CASE RELATIONS
// ============================================

async function saveCaseRelations(id) {
    const payload = {
        judge_ids: currentRelations.judges,
        topic_ids: getSelectedTopicIds(),
        legislation: currentRelations.legislation
    };

    return apiRequest(
        `/admin/cases/${id}/relations`,
        {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        }
    );
}

// ============================================
// SUBMIT FORM
// ============================================

form.addEventListener("submit", async event => {
    event.preventDefault();

    hideMessage();

    syncJudgmentText();

    const payload = buildCasePayload();

    if (!payload.title) {
        showMessage("Please enter the Case Title.", "error");
        return;
    }

    if (!quill.getText().trim()) {
        showMessage("Please enter the Judgment Text.", "error");
        return;
    }

    if (!subjectSelect.value) {
        showMessage(
            "Please select a Primary Legal Subject.",
            "error"
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        let savedCaseId = caseId;

        if (caseId) {
            await apiRequest(
                `/admin/cases/${caseId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );
        } else {
            const data = await apiRequest(
                "/admin/cases",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            savedCaseId = data.case?.id;

            if (!savedCaseId) {
                throw new Error(
                    "Case was saved but its ID was not returned."
                );
            }
        }

        // Save Legal Subject and Topics.
        await saveCaseRelations(savedCaseId);

        showMessage(
            "Case and Legal Classification saved successfully!",
            "success"
        );

        saveButton.textContent = "Saved";

        setTimeout(() => {
            window.location.href = "./editor-dashboard.html";
        }, 1200);

    } catch (error) {
        console.error("Case saving error:", error);

        showMessage(error.message, "error");

        saveButton.disabled = false;
        saveButton.textContent = caseId
            ? "Update Draft"
            : "Save Draft";
    }
});

// ============================================
// INITIALIZE
// ============================================

async function initializePage() {
    try {
        initializeJudgmentEditor();

        const authenticated = await checkAuthentication();

        if (!authenticated) return;

        await loadLegalTopics();

        if (caseId) {
            await loadExistingCase();
        }

    } catch (error) {
        console.error("Page initialization error:", error);

        showMessage(
            error.message || "Could not initialize the Case Entry Form.",
            "error"
        );
    }
}

initializePage();

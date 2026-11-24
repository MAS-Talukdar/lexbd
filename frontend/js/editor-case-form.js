
const API_BASE_URL = "https://lexbd-backend.onrender.com/api";

const caseForm = document.getElementById("caseForm");
const messageBox = document.getElementById("message");
const saveButton = document.getElementById("saveButton");

const params = new URLSearchParams(window.location.search);
const caseId = params.get("id");

const fields = [
    "title",
    "case_number",
    "petitioner",
    "respondent",
    "citation",
    "court_id",
    "decision_year",
    "decision_date",
    "judgment_text",
    "pdf_url",
    "source_url"
];

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function showMessage(message, type = "error") {
    messageBox.textContent = message;
    messageBox.className =
        "mb-5 p-3 rounded-lg text-sm " +
        (type === "success"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700");
}

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

async function loadCase() {
    if (!caseId) return;

    try {
        const data = await apiRequest(`/admin/cases/${caseId}`);

        const caseData = data.case;

        fields.forEach(field => {
            const input = document.getElementById(field);

            let value = caseData[field] ?? "";

            if (field === "decision_date" && value) {
                value = String(value).slice(0, 10);
            }

            input.value = value;
        });

        document.getElementById("formTitle").textContent =
            "Edit Case";

        saveButton.textContent = "Update Case";

    } catch (error) {
        showMessage(error.message);
        saveButton.disabled = true;
    }
}

caseForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const payload = {};

    fields.forEach(field => {
        const value = document.getElementById(field).value.trim();

        if (field === "court_id" || field === "decision_year") {
            payload[field] = value === "" ? null : Number(value);
        } else {
            payload[field] = value === "" ? null : value;
        }
    });

    if (!payload.title) {
        showMessage("Case title is required.");
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const endpoint = caseId
            ? `/admin/cases/${caseId}`
            : "/admin/cases";

        const method = caseId ? "PATCH" : "POST";

        const data = await apiRequest(endpoint, {
            method,
            body: JSON.stringify(payload)
        });

        showMessage(data.message, "success");

        saveButton.textContent = "Saved";

        setTimeout(() => {
            window.location.href = "./editor-dashboard.html";
        }, 1000);

    } catch (error) {
        showMessage(error.message);

        saveButton.disabled = false;
        saveButton.textContent = caseId
            ? "Update Case"
            : "Save Draft";
    }
});

async function initializeForm() {
    const authorized = await checkEditorAccess();

    if (!authorized) return;

    if (caseId) {
        await loadCase();
    }
}

initializeForm();

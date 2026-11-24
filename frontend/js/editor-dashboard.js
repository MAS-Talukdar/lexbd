const API_BASE_URL = "/api";

const editorName = document.getElementById("editorName");
const welcomeName = document.getElementById("welcomeName");
const caseTableBody = document.getElementById("caseTableBody");
const messageBox = document.getElementById("message");

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

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
        "mb-4 p-3 rounded-lg text-sm " +
        (type === "success"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700");
}

function getCasesFromResponse(data) {
    if (Array.isArray(data.cases)) return data.cases;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
}

// Verify Editor Authentication
async function checkEditorAccess() {
    try {
        const data = await apiRequest("/auth/me");

        if (!data.authenticated || !data.user) {
            window.location.href = "./login.html";
            return false;
        }

        const user = data.user;

        if (user.role === "admin") {
            window.location.href = "./admin-dashboard.html";
            return false;
        }

        if (user.role === "user") {
            window.location.href = "./user-dashboard.html";
            return false;
        }

        if (user.role !== "editor") {
            window.location.href = "./login.html";
            return false;
        }

        editorName.textContent = user.name;
        welcomeName.textContent = user.name;

        return true;

    } catch (error) {
        window.location.href = "./login.html";
        return false;
    }
}

// Load Case Records
async function loadCases() {
    try {
        caseTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="p-6 text-center">
                    Loading cases...
                </td>
            </tr>
        `;

        const data = await apiRequest("/admin/cases?limit=100&page=1");

        const cases = getCasesFromResponse(data);

        document.getElementById("totalCases").textContent =
            data.pagination?.total ?? cases.length;

        document.getElementById("draftCases").textContent =
            cases.filter(item => item.status === "draft").length;

        document.getElementById("publishedCases").textContent =
            cases.filter(item => item.status === "published").length;

        if (cases.length === 0) {
            caseTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="p-6 text-center text-slate-500">
                        No case records found.
                    </td>
                </tr>
            `;
            return;
        }

        caseTableBody.innerHTML = cases.map(item => `
            <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="p-3 font-medium">
                    ${escapeHTML(item.title || "Untitled Case")}
                </td>

                <td class="p-3">
                    ${escapeHTML(String(item.decision_year || "—"))}
                </td>

                <td class="p-3">
                    <span class="px-2 py-1 rounded text-xs font-semibold
                        ${item.status === "published"
                            ? "bg-green-100 text-green-700"
                            : item.status === "archived"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-amber-100 text-amber-700"}">
                        ${escapeHTML(item.status || "draft")}
                    </span>
                </td>

                <td class="p-3">
                    <a href="./editor-case-form.html?id=${encodeURIComponent(item.id)}"
                       class="text-blue-700 hover:underline font-semibold">
                        Edit
                    </a>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        caseTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="p-6 text-center text-red-600">
                    Could not load case records.
                </td>
            </tr>
        `;

        showMessage(error.message);
    }
}

// Prevent HTML injection in case titles
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Logout
document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await apiRequest("/auth/logout", {
            method: "POST"
        });

        window.location.href = "./login.html";

    } catch (error) {
        showMessage("Logout failed. Please try again.");
    }
});

// Refresh
document.getElementById("refreshButton").addEventListener("click", loadCases);

// Initialize
async function initializeDashboard() {
    const authorized = await checkEditorAccess();

    if (authorized) {
        await loadCases();
    }
}

initializeDashboard();

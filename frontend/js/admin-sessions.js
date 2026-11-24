
const sessionsTableBody = document.getElementById("sessionsTableBody");
const totalSessions = document.getElementById("totalSessions");
const sessionMessage = document.getElementById("sessionMessage");
const refreshButton = document.getElementById("refreshSessions");

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

function showSessionMessage(message, type = "error") {
    sessionMessage.textContent = message;
    sessionMessage.className = "rounded-lg p-4 mb-6 text-sm";

    if (type === "success") {
        sessionMessage.classList.add("bg-green-50", "text-green-700");
    } else {
        sessionMessage.classList.add("bg-red-50", "text-red-700");
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function formatExpiry(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
}

async function loadSessions() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";

    sessionsTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-10 text-center text-slate-500">
                Loading sessions...
            </td>
        </tr>
    `;

    try {
        const response = await apiRequest("/admin/sessions");

        if (!response.success) {
            throw new Error(response.message || "Unable to load sessions.");
        }

        const sessions = response.sessions || [];

        totalSessions.textContent =
            Number(response.total ?? sessions.length).toLocaleString();

        if (sessions.length === 0) {
            sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center text-slate-500">
                        No active Editor or User sessions found.
                    </td>
                </tr>
            `;
            return;
        }

        sessionsTableBody.innerHTML = sessions.map(session => `
            <tr class="border-t border-slate-100 hover:bg-slate-50">

                <td class="px-6 py-4 font-medium text-slate-800">
                    ${escapeHTML(session.name)}
                </td>

                <td class="px-6 py-4 text-slate-600">
                    ${escapeHTML(session.email || "—")}
                </td>

                <td class="px-6 py-4">
                    <span class="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs">
                        ${escapeHTML(session.role)}
                    </span>
                </td>

                <td class="px-6 py-4 text-slate-600">
                    ${escapeHTML(formatExpiry(session.expires_at))}
                </td>

                <td class="px-6 py-4">
                    <button
                        type="button"
                        data-session-ref="${escapeHTML(session.session_ref)}"
                        class="revoke-session bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                        Revoke
                    </button>
                </td>

            </tr>
        `).join("");

    } catch (error) {
        console.error("Session Loading Error:", error);

        sessionsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-red-600">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh Sessions";
    }
}

sessionsTableBody.addEventListener("click", async function (event) {
    const button = event.target.closest(".revoke-session");

    if (!button) return;

    const sessionRef = button.dataset.sessionRef;

    if (!sessionRef) return;

    const confirmed = window.confirm(
        "Are you sure you want to revoke this user's session?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Revoking...";

    try {
        const response = await apiRequest(
            `/admin/sessions/${encodeURIComponent(sessionRef)}`,
            { method: "DELETE" }
        );

        if (!response.success) {
            throw new Error(response.message || "Session revocation failed.");
        }

        showSessionMessage(
            "User session revoked successfully.",
            "success"
        );

        await loadSessions();

    } catch (error) {
        showSessionMessage(
            error.message || "Unable to revoke session."
        );

        button.disabled = false;
        button.textContent = "Revoke";
    }
});

refreshButton.addEventListener("click", loadSessions);

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await AuthAPI.logout();
        window.location.href = "./login.html";
    } catch (error) {
        showSessionMessage(error.message || "Logout failed.");
    }
});

async function initializeSessionPage() {
    try {
        const response = await AuthAPI.getCurrentUser();

        if (!response.success || !response.user) {
            window.location.href = "./login.html";
            return;
        }

        if (response.user.role !== "admin") {
            window.location.href = "./index.html";
            return;
        }

        await loadSessions();

    } catch (error) {
        window.location.href = "./login.html";
    }
}

document.addEventListener("DOMContentLoaded", initializeSessionPage);

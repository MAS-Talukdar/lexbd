document.getElementById("currentYear").textContent =
    new Date().getFullYear();

function showDashboardMessage(message, type = "error") {
    const element = document.getElementById("dashboardMessage");

    element.textContent = message;
    element.className = "rounded-lg p-4 mb-6 text-sm";

    if (type === "success") {
        element.classList.add("bg-green-50", "text-green-700");
    } else {
        element.classList.add("bg-red-50", "text-red-700");
    }
}

function setStatistic(id, value) {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent =
        value === null || value === undefined
            ? "0"
            : Number(value).toLocaleString();
}


// =====================================
// Dashboard Statistics
// =====================================

async function loadDashboardStatistics() {
    try {
        const response = await apiRequest("/admin/statistics");

        if (!response.success || !response.statistics) {
            throw new Error("Unable to load dashboard statistics.");
        }

        const stats = response.statistics;

        setStatistic("totalCases", stats.total_cases);
        setStatistic("publishedCases", stats.published_cases);
        setStatistic("draftCases", stats.draft_cases);
        setStatistic("archivedCases", stats.archived_cases);

        setStatistic("totalUsers", stats.total_users);
        setStatistic("activeUsers", stats.active_users);
        setStatistic("inactiveUsers", stats.inactive_users);

        setStatistic("totalCourts", stats.total_courts);
        setStatistic("totalJudges", stats.total_judges);
        setStatistic("totalTopics", stats.total_topics);
        setStatistic("totalLegislation", stats.total_legislation);

    } catch (error) {
        console.error("Statistics Error:", error);

        showDashboardMessage(
            error.message || "Unable to load dashboard statistics."
        );
    }
}


// =====================================
// Recent Case Activity
// =====================================

function renderRecentActivities(activities) {
    const tableBody = document.getElementById(
        "recentActivityTableBody"
    );

    if (!tableBody) return;

    tableBody.replaceChildren();

    if (!Array.isArray(activities) || activities.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "px-5 py-8 text-center text-slate-500";
        cell.textContent = "No recent case activities found.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        return;
    }

    activities.forEach((activity) => {
        const row = document.createElement("tr");
        row.className = "border-b last:border-b-0 hover:bg-slate-50";

        const actionCell = document.createElement("td");
        actionCell.className = "px-5 py-4 font-medium text-[#001233]";

        const actionLabels = {
            CREATE: "Case Created",
            UPDATE: "Case Updated",
            PUBLISH: "Case Published",
            UNPUBLISH: "Case Unpublished",
            ARCHIVE: "Case Archived",
            RESTORE: "Case Restored",
            UPDATE_RELATIONS: "Relations Updated"
        };

        actionCell.textContent =
            actionLabels[activity.action] || activity.action || "Activity";

        const descriptionCell = document.createElement("td");
        descriptionCell.className = "px-5 py-4 text-slate-600";
        descriptionCell.textContent = activity.description || "—";

        const actorCell = document.createElement("td");
        actorCell.className = "px-5 py-4 text-slate-600";

        actorCell.textContent =
            activity.actor_name ||
            activity.name ||
            activity.actor_email ||
            activity.email ||
            "Unknown";

        const dateCell = document.createElement("td");
        dateCell.className = "px-5 py-4 text-slate-500 whitespace-nowrap";

        const date = new Date(activity.created_at);

        dateCell.textContent = Number.isNaN(date.getTime())
            ? "Unknown"
            : date.toLocaleString();

        row.append(
            actionCell,
            descriptionCell,
            actorCell,
            dateCell
        );

        tableBody.appendChild(row);
    });
}


async function loadRecentActivities() {
    const tableBody = document.getElementById(
        "recentActivityTableBody"
    );

    if (!tableBody) return;

    try {
        const response = await apiRequest("/admin/activity?limit=100");

        if (!response.success || !Array.isArray(response.activities)) {
            throw new Error("Unable to load recent activities.");
        }

        renderRecentActivities(response.activities);

    } catch (error) {
        console.error("Recent Activity Error:", error);

        tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "px-5 py-8 text-center text-red-600";
        cell.textContent = "Could not load recent activities.";

        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}


// =====================================
// Pending Case Revisions
// =====================================

const revisionFields = {
    title: "Case Title",
    case_number: "Case Number",
    petitioner: "Petitioner",
    respondent: "Respondent",
    citation: "Citation",
    court_id: "Court ID",
    decision_year: "Decision Year",
    decision_date: "Decision Date",
    judgment_text: "Judgment Text",
    pdf_url: "PDF URL",
    source_url: "Source URL"
};


function formatRevisionValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    return String(value);
}


function createRevisionElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}


function renderRevisionComparison(previousData, proposedData) {
    const container = document.createElement("div");

    container.className = "mt-5 overflow-x-auto";

    const heading = createRevisionElement(
        "h3",
        "font-semibold text-[#001233] mb-3",
        "Proposed Changes"
    );

    container.appendChild(heading);

    const table = document.createElement("table");
    table.className = "w-full text-sm border border-slate-200";

    const thead = document.createElement("thead");
    thead.className = "bg-slate-50";

    const headerRow = document.createElement("tr");

    ["Field", "Previous Value", "Proposed Value"].forEach((label) => {
        const th = createRevisionElement(
            "th",
            "text-left px-4 py-3 border-b border-slate-200",
            label
        );

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    let changedFields = 0;

    Object.entries(revisionFields).forEach(([key, label]) => {
        const previousValue = previousData?.[key];
        const proposedValue = proposedData?.[key];

        if (JSON.stringify(previousValue ?? null) ===
            JSON.stringify(proposedValue ?? null)) {
            return;
        }

        changedFields++;

        const row = document.createElement("tr");
        row.className = "border-b border-slate-100 align-top";

        const fieldCell = createRevisionElement(
            "td",
            "px-4 py-3 font-medium text-[#001233] whitespace-nowrap",
            label
        );

        const oldCell = createRevisionElement(
            "td",
            "px-4 py-3 text-slate-600 whitespace-pre-wrap break-words",
            formatRevisionValue(previousValue)
        );

        const newCell = createRevisionElement(
            "td",
            "px-4 py-3 text-blue-800 whitespace-pre-wrap break-words",
            formatRevisionValue(proposedValue)
        );

        row.append(fieldCell, oldCell, newCell);
        tbody.appendChild(row);
    });

    if (changedFields === 0) {
        const row = document.createElement("tr");
        const cell = createRevisionElement(
            "td",
            "px-4 py-5 text-center text-slate-500",
            "No field differences found."
        );

        cell.colSpan = 3;
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    table.append(thead, tbody);
    container.appendChild(table);

    return container;
}


function renderPendingRevisions(revisions) {
    const container = document.getElementById(
        "pendingRevisionsContainer"
    );

    const countElement = document.getElementById(
        "pendingRevisionCount"
    );

    if (!container) return;

    container.replaceChildren();

    const pendingList = Array.isArray(revisions) ? revisions : [];

    if (countElement) {
        countElement.textContent =
            `${pendingList.length} Pending`;
    }

    if (pendingList.length === 0) {
        const emptyState = createRevisionElement(
            "div",
            "bg-white border border-slate-200 rounded-xl p-8 text-center",
        );

        emptyState.appendChild(
            createRevisionElement(
                "p",
                "text-slate-600 font-medium",
                "No pending revisions."
            )
        );

        emptyState.appendChild(
            createRevisionElement(
                "p",
                "text-sm text-slate-400 mt-2",
                "New Editor revision requests will appear here."
            )
        );

        container.appendChild(emptyState);

        return;
    }

    pendingList.forEach((revision) => {
        const card = createRevisionElement(
            "article",
            "bg-white border border-slate-200 rounded-xl shadow-sm p-5"
        );

        const header = createRevisionElement(
            "div",
            "flex flex-wrap justify-between gap-3"
        );

        const information = createRevisionElement("div", "");

        information.appendChild(
            createRevisionElement(
                "h3",
                "text-lg font-bold text-[#001233]",
                revision.case_title ||
                revision.title ||
                `Case #${revision.case_id}`
            )
        );

        information.appendChild(
            createRevisionElement(
                "p",
                "text-sm text-slate-500 mt-2",
                `Case ID: ${revision.case_id ?? "—"}`
            )
        );

        information.appendChild(
            createRevisionElement(
                "p",
                "text-sm text-slate-500 mt-1",
                `Submitted by: ${revision.submitted_by_name || revision.editor_name || "Unknown"}`
            )
        );

        const date = new Date(revision.created_at);

        information.appendChild(
            createRevisionElement(
                "p",
                "text-xs text-slate-400 mt-1",
                Number.isNaN(date.getTime())
                    ? "Submission date unavailable"
                    : `Submitted: ${date.toLocaleString()}`
            )
        );

        const status = createRevisionElement(
            "span",
            "inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold h-fit",
            "PENDING"
        );

        header.append(information, status);
        card.appendChild(header);

        if (revision.changes_markdown) {
            const summary = createRevisionElement(
                "div",
                "mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4"
            );

            summary.appendChild(
                createRevisionElement(
                    "h4",
                    "font-semibold text-[#001233] mb-2",
                    "Change Summary"
                )
            );

            summary.appendChild(
                createRevisionElement(
                    "pre",
                    "text-sm text-slate-600 whitespace-pre-wrap break-words font-sans",
                    revision.changes_markdown
                )
            );

            card.appendChild(summary);
        }

        card.appendChild(
            renderRevisionComparison(
                revision.previous_data || {},
                revision.proposed_data || {}
            )
        );

        const noteLabel = createRevisionElement(
            "label",
            "block text-sm font-medium text-slate-700 mt-5 mb-2",
            "Review Note (optional)"
        );

        const noteInput = document.createElement("textarea");
        noteInput.className =
            "w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
        noteInput.rows = 2;
        noteInput.placeholder =
            "Write a reason or note for this decision...";

        const actionContainer = createRevisionElement(
            "div",
            "flex flex-wrap gap-3 mt-4"
        );

        const approveButton = createRevisionElement(
            "button",
            "bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium",
            "Approve Revision"
        );

        approveButton.type = "button";

        const rejectButton = createRevisionElement(
            "button",
            "bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium",
            "Reject Revision"
        );

        rejectButton.type = "button";

        approveButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "Are you sure you want to approve this revision? The published case will be updated."
            );

            if (!confirmed) return;

            await reviewRevision(
                revision.id,
                "approve",
                noteInput.value,
                approveButton,
                rejectButton
            );
        });

        rejectButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "Are you sure you want to reject this revision?"
            );

            if (!confirmed) return;

            await reviewRevision(
                revision.id,
                "reject",
                noteInput.value,
                approveButton,
                rejectButton
            );
        });

        actionContainer.append(approveButton, rejectButton);

        card.append(
            noteLabel,
            noteInput,
            actionContainer
        );

        container.appendChild(card);
    });
}


// =====================================
// Load Pending Revisions
// =====================================

async function loadPendingRevisions() {
    const container = document.getElementById(
        "pendingRevisionsContainer"
    );

    if (!container) return;

    try {
        const response = await apiRequest(
            "/admin/cases/revisions/pending"
        );

        if (!response.success || !Array.isArray(response.revisions)) {
            throw new Error("Unable to load pending revisions.");
        }

        renderPendingRevisions(response.revisions);

    } catch (error) {
        console.error("Pending Revisions Error:", error);

        container.replaceChildren();

        container.appendChild(
            createRevisionElement(
                "div",
                "bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700",
                error.message || "Could not load pending revisions."
            )
        );
    }
}


// =====================================
// Approve / Reject Revision
// =====================================

async function reviewRevision(
    revisionId,
    action,
    reviewNote,
    approveButton,
    rejectButton
) {
    approveButton.disabled = true;
    rejectButton.disabled = true;

    const originalApproveText = approveButton.textContent;
    const originalRejectText = rejectButton.textContent;

    approveButton.textContent = "Processing...";
    rejectButton.textContent = "Processing...";

    try {
        const response = await apiRequest(
            `/admin/cases/revisions/${encodeURIComponent(revisionId)}/${action}`,
            {
                method: "POST",
                body: JSON.stringify({
                    review_note: reviewNote.trim()
                })
            }
        );

        if (!response.success) {
            throw new Error(
                response.message || `Could not ${action} revision.`
            );
        }

        showRevisionMessage(
            response.message ||
                (action === "approve"
                    ? "Revision approved successfully."
                    : "Revision rejected successfully."),
            "success"
        );

        await Promise.all([
            loadPendingRevisions(),
            loadDashboardStatistics()
        ]);

    } catch (error) {
        console.error("Revision Review Error:", error);

        showRevisionMessage(
            error.message || `Could not ${action} revision.`,
            "error"
        );

        approveButton.disabled = false;
        rejectButton.disabled = false;

        approveButton.textContent = originalApproveText;
        rejectButton.textContent = originalRejectText;
    }
}


function showRevisionMessage(message, type = "error") {
    const element = document.getElementById("revisionMessage");

    if (!element) return;

    element.textContent = message;
    element.className = "rounded-lg p-4 mb-5 text-sm";

    if (type === "success") {
        element.classList.add("bg-green-50", "text-green-700");
    } else {
        element.classList.add("bg-red-50", "text-red-700");
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


// =====================================
// Refresh Buttons
// =====================================

const refreshStatisticsButton = document.getElementById(
    "refreshStatisticsButton"
);

if (refreshStatisticsButton) {
    refreshStatisticsButton.addEventListener("click", async function () {
        refreshStatisticsButton.disabled = true;
        refreshStatisticsButton.textContent = "Refreshing...";

        await loadDashboardStatistics();

        refreshStatisticsButton.disabled = false;
        refreshStatisticsButton.textContent = "↻ Refresh Statistics";
    });
}


const refreshActivityButton = document.getElementById(
    "refreshActivityButton"
);

if (refreshActivityButton) {
    refreshActivityButton.addEventListener("click", async function () {
        refreshActivityButton.disabled = true;
        refreshActivityButton.textContent = "Refreshing...";

        await loadRecentActivities();

        refreshActivityButton.disabled = false;
        refreshActivityButton.textContent = "↻ Refresh Activity";
    });
}


const refreshRevisionsButton = document.getElementById(
    "refreshRevisionsButton"
);

if (refreshRevisionsButton) {
    refreshRevisionsButton.addEventListener("click", async function () {
        refreshRevisionsButton.disabled = true;
        refreshRevisionsButton.textContent = "Refreshing...";

        await loadPendingRevisions();

        refreshRevisionsButton.disabled = false;
        refreshRevisionsButton.textContent = "↻ Refresh";
    });
}


// =====================================
// Load Admin Dashboard
// =====================================

async function loadAdminDashboard() {
    try {
        const authResponse = await AuthAPI.getCurrentUser();
        const currentUser = authResponse.user;

        if (!authResponse.success || !currentUser) {
            window.location.href = "./login.html";
            return;
        }

        if (currentUser.role !== "admin") {
            window.location.href = "./index.html";
            return;
        }

        document.getElementById("adminName").textContent =
            currentUser.name || currentUser.email || "Administrator";

        await Promise.all([
            loadDashboardStatistics(),
            loadRecentActivities(),
            loadPendingRevisions()
        ]);

        // Refresh dashboard data every 30 seconds.
        setInterval(() => {
            loadDashboardStatistics();
            loadRecentActivities();
            loadPendingRevisions();
        }, 30000);

    } catch (error) {
        console.error("Dashboard Error:", error);

        showDashboardMessage(
            error.message || "Unable to load Admin Dashboard."
        );
    }
}


// =====================================
// Logout
// =====================================

document.getElementById("logoutButton")
    .addEventListener("click", async function () {
        try {
            await AuthAPI.logout();
            window.location.href = "./login.html";
        } catch (error) {
            showDashboardMessage(
                error.message || "Logout failed."
            );
        }
    });


document.addEventListener("DOMContentLoaded", loadAdminDashboard);
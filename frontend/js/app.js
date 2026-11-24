
console.log("LEXBD Frontend Loaded");


// ==================================
// 1. Backend Connection
// ==================================

async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();

        console.log("Backend Connection:", data);

    } catch (error) {
        console.error("Backend Connection Failed:", error.message);
    }
}


// ==================================
// 2. HTML Escape
// ==================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// ==================================
// 3. Dynamic Account Navigation
// ==================================

async function initializeAccountNavigation() {

    const accountNavigation = document.getElementById(
        "accountNavigation"
    );

    if (!accountNavigation) return;

    try {

        const response = await AuthAPI.getCurrentUser();

        if (!response.success || !response.user) {
            throw new Error("Not logged in");
        }

        const user = response.user;

        let dashboardLink = "./user-dashboard.html";
        let dashboardLabel = "My Dashboard";

        if (user.role === "admin") {
            dashboardLink = "./admin-dashboard.html";
            dashboardLabel = "Admin Dashboard";
        }

        accountNavigation.innerHTML = `
            <a
                href="${dashboardLink}"
                class="border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-100 transition"
            >
                ${dashboardLabel}
            </a>

            <button
                type="button"
                id="logoutButton"
                class="bg-blue-950 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-900 transition"
            >
                Logout
            </button>
        `;

        const logoutButton = document.getElementById("logoutButton");

        logoutButton.addEventListener("click", async () => {

            logoutButton.disabled = true;
            logoutButton.textContent = "Logging out...";

            try {
                await AuthAPI.logout();
                window.location.reload();

            } catch (error) {
                console.error("Logout failed:", error.message);

                logoutButton.disabled = false;
                logoutButton.textContent = "Logout";

                alert("Unable to logout. Please try again.");
            }
        });

    } catch (error) {

        // Guest navigation remains visible.
        console.log("Visitor is not logged in.");

    }
}


// ==================================
// 4. Render Cases
// ==================================

function renderCases(cases, container) {

    if (!cases.length) {
        container.innerHTML = `
            <p class="col-span-full text-center py-10 text-slate-500">
                No cases found.
            </p>
        `;
        return;
    }

    container.innerHTML = cases.map((item) => `
        <article class="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition">

            <p class="text-xs text-amber-600 font-semibold mb-3">
                ${escapeHTML(item.court_name || "Court not specified")}
            </p>

            <h3 class="text-lg font-bold text-blue-950 mb-3">
                ${escapeHTML(item.title || "Untitled Case")}
            </h3>

            <p class="text-sm text-slate-500 mb-2">
                Case Number: ${escapeHTML(item.case_number || "Not available")}
            </p>

            <p class="text-sm text-slate-500 mb-4">
                Decision Year: ${escapeHTML(item.decision_year || "Not available")}
            </p>

            <button
                type="button"
                class="text-sm font-semibold text-blue-950 hover:text-amber-600"
                data-case-id="${escapeHTML(item.id)}"
            >
                View Case Details →
            </button>

        </article>
    `).join("");
}


// ==================================
// 5. Load Latest Cases
// ==================================

async function loadLatestCases() {

    const container = document.getElementById("latestCases");

    if (!container) return;

    container.innerHTML = `
        <p class="col-span-full text-center py-10 text-slate-500">
            Loading cases...
        </p>
    `;

    try {

        const response = await CaseAPI.getLatestCases(6);

        renderCases(response.cases || [], container);

    } catch (error) {

        console.error("Loading cases failed:", error.message);

        container.innerHTML = `
            <p class="col-span-full text-center py-10 text-red-500">
                Unable to load cases. Please try again later.
            </p>
        `;
    }
}


// ==================================
// 6. Search Cases
// ==================================

async function searchCases(searchTerm) {

    const container = document.getElementById("latestCases");

    if (!container) return;

    container.innerHTML = `
        <p class="col-span-full text-center py-10 text-slate-500">
            Searching cases...
        </p>
    `;

    try {

        const response = await CaseAPI.searchCases({
            q: searchTerm,
            page: 1,
            limit: 20
        });

        renderCases(response.cases || [], container);

        const total =
            response.pagination?.total ??
            response.cases?.length ??
            0;

        const resultInfo = document.getElementById("searchResultInfo");

        if (resultInfo) {
            resultInfo.textContent = `${total} case(s) found`;
        }

        document.getElementById("cases")?.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error("Case search failed:", error.message);

        container.innerHTML = `
            <p class="col-span-full text-center py-10 text-red-500">
                Search failed. Please try again.
            </p>
        `;
    }
}


// ==================================
// 7. Search Form Event
// ==================================

function initializeSearch() {

    const searchForm = document.getElementById("searchForm");
    const searchInput = document.getElementById("searchInput");

    if (!searchForm || !searchInput) return;

    searchForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const searchTerm = searchInput.value.trim();

        if (!searchTerm) {
            searchInput.focus();
            return;
        }

        searchCases(searchTerm);
    });
}


// ==================================
// 8. Case Navigation
// ==================================

function initializeCaseNavigation() {

    const container = document.getElementById("latestCases");

    if (!container) return;

    container.addEventListener("click", (event) => {

        const button = event.target.closest("[data-case-id]");

        if (!button) return;

        const caseId = button.dataset.caseId;

        if (!caseId) return;

        window.location.href =
            `case.html?id=${encodeURIComponent(caseId)}`;
    });
}


// ==================================
// 9. Homepage Initialization
// ==================================

document.addEventListener("DOMContentLoaded", () => {

    initializeAccountNavigation();

    initializeCaseNavigation();

    checkBackendConnection();

    loadLatestCases();

    initializeSearch();

    const yearElement = document.getElementById("currentYear");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

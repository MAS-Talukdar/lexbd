
const userName = document.getElementById("userName");
const welcomeName = document.getElementById("welcomeName");
const userEmail = document.getElementById("userEmail");

const logoutButton = document.getElementById("logoutButton");

const caseSearchForm = document.getElementById("caseSearchForm");
const caseSearchInput = document.getElementById("caseSearchInput");

const searchResults = document.getElementById("searchResults");
const searchMessage = document.getElementById("searchMessage");


async function loadUserDashboard() {
    try {
        const response = await AuthAPI.getCurrentUser();

        if (!response.success || !response.user) {
            window.location.href = "./login.html";
            return;
        }

        const user = response.user;

        // Admin should use Admin Dashboard
        if (user.role === "admin") {
            window.location.href = "./admin-dashboard.html";
            return;
        }

        userName.textContent = user.name;
        welcomeName.textContent = user.name;
        userEmail.textContent = user.email;

    } catch (error) {
        window.location.href = "./login.html";
    }
}


// Search published cases
caseSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = caseSearchInput.value.trim();

    if (!query) {
        searchMessage.textContent = "Please enter a search term.";
        searchMessage.className = "mt-5 text-sm text-red-600";
        return;
    }

    searchResults.replaceChildren();

    searchMessage.textContent = "Searching cases...";
    searchMessage.className = "mt-5 text-sm text-slate-500";

    try {
        const response = await CaseAPI.searchCases({ q: query });

        const cases = response.cases || [];

        if (cases.length === 0) {
            searchMessage.textContent = "No published cases found.";
            return;
        }

        searchMessage.textContent = `${cases.length} result(s) found.`;

        cases.forEach((item) => {
            const card = document.createElement("article");

            card.className =
                "border border-slate-200 rounded-lg p-5 hover:border-[#A37A00]";

            const title = document.createElement("h3");
            title.className = "font-bold text-[#001233] text-lg";
            title.textContent = item.title || "Untitled Case";

            const citation = document.createElement("p");
            citation.className = "text-sm text-slate-500 mt-2";
            citation.textContent = item.citation || "Citation unavailable";

            const link = document.createElement("a");
            link.href = `./case-details.html?id=${encodeURIComponent(item.id)}`;
            link.textContent = "View Case →";
            link.className =
                "inline-block mt-4 text-sm font-semibold text-[#A37A00]";

            card.append(title, citation, link);
            searchResults.appendChild(card);
        });

    } catch (error) {
        searchMessage.textContent =
            error.message || "Unable to search cases.";

        searchMessage.className = "mt-5 text-sm text-red-600";
    }
});


// Logout
logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        await AuthAPI.logout();
        window.location.href = "./login.html";

    } catch (error) {
        alert(error.message || "Logout failed.");
        logoutButton.disabled = false;
    }
});


// Start dashboard
document.addEventListener("DOMContentLoaded", loadUserDashboard);

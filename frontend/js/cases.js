const directoryCases = document.getElementById("directoryCases");
const caseSearchForm = document.getElementById("caseSearchForm");
const caseSearchInput = document.getElementById("caseSearchInput");
const caseResultInfo = document.getElementById("caseResultInfo");
const casePagination = document.getElementById("casePagination");
const refreshCasesButton = document.getElementById("refreshCasesButton");

let currentPage = 1;
const casesPerPage = 12;
let currentSearchTerm = "";
let currentFilters = {};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character];
  });
}

function showCasesMessage(message) {
  directoryCases.innerHTML = `
        <div class="col-span-full bg-white border rounded-xl p-8 text-center text-slate-500">
            ${escapeHTML(message)}
        </div>
    `;
}

function renderDirectoryCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    showCasesMessage("No published cases found.");
    return;
  }

  directoryCases.innerHTML = cases
    .map(function (item) {
      return `
            <article class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">

                <h3 class="text-lg font-semibold text-blue-950 mb-3">
                    ${escapeHTML(item.title || "Untitled Case")}
                </h3>

                <div class="space-y-2 text-sm text-slate-600">

                    <p>
                        <strong>Case Number:</strong>
                        ${escapeHTML(item.case_number || "Not available")}
                    </p>

                    <p>
                        <strong>Citation:</strong>
                        ${escapeHTML(item.citation || "Not available")}
                    </p>

                    <p>
                        <strong>Decision Year:</strong>
                        ${escapeHTML(item.decision_year || "Not available")}
                    </p>

                    <p>
                        <strong>Petitioner:</strong>
                        ${escapeHTML(item.petitioner || "Not available")}
                    </p>

                    <p>
                        <strong>Respondent:</strong>
                        ${escapeHTML(item.respondent || "Not available")}
                    </p>

                </div>

                <button
                    type="button"
                    data-case-id="${escapeHTML(item.id)}"
                    class="view-case-button mt-5 w-full bg-blue-950 text-white py-2.5 rounded-lg hover:bg-blue-900"
                >
                    View Case Details
                </button>

            </article>
        `;
    })
    .join("");
}

function renderPagination(totalPages) {
  casePagination.innerHTML = "";

  if (!Number.isInteger(totalPages) || totalPages <= 1) {
    return;
  }

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.textContent = "Previous";
  previousButton.disabled = currentPage <= 1;
  previousButton.className =
    "px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-slate-100";

  previousButton.addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage--;
      loadDirectoryCases();
    }
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "text-sm text-slate-600";
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = "Next";
  nextButton.disabled = currentPage >= totalPages;
  nextButton.className =
    "px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-slate-100";

  nextButton.addEventListener("click", function () {
    if (currentPage < totalPages) {
      currentPage++;
      loadDirectoryCases();
    }
  });

  casePagination.append(previousButton, pageInfo, nextButton);
}

async function loadDirectoryCases() {
  showCasesMessage("Loading published cases...");

  caseResultInfo.textContent = "Loading...";
  casePagination.innerHTML = "";

  try {
    const searchParams = {
      q: currentSearchTerm,
      page: currentPage,
      limit: casesPerPage,
      ...currentFilters,
    };

    const cleanedParams = {};

    Object.entries(searchParams).forEach(function ([key, value]) {
      if (value !== "" && value !== null && value !== undefined) {
        cleanedParams[key] = value;
      }
    });

    const response = await CaseAPI.searchCases(cleanedParams);

    if (!response.success) {
      throw new Error(response.message || "Unable to load cases.");
    }

    const cases = response.cases || [];
    const pagination = response.pagination || {};

    renderDirectoryCases(cases);

    const total = Number(pagination.total ?? pagination.total_cases ?? 0);

    const totalPages = Number(
      pagination.total_pages ?? pagination.totalPages ?? 0,
    );

    caseResultInfo.textContent = `${total} published case(s) found.`;

    renderPagination(totalPages);
  } catch (error) {
    console.error("Case Directory Error:", error);

    showCasesMessage(error.message || "Unable to load published cases.");

    caseResultInfo.textContent = "Unable to load cases.";
  }
}

// Search
caseSearchForm.addEventListener("submit", function (event) {
    event.preventDefault();

    currentSearchTerm = caseSearchInput.value.trim();

    currentPage = 1;

    loadDirectoryCases();
});

// Refresh
refreshCasesButton.addEventListener("click", function () {
  loadDirectoryCases();
});

// Open Case Details
directoryCases.addEventListener("click", function (event) {
  const button = event.target.closest(".view-case-button");

  if (!button) return;

  const caseId = button.dataset.caseId;

  if (!caseId) return;

  window.location.href = `./case.html?id=${encodeURIComponent(caseId)}`;
});

// Initial Load
document.addEventListener("DOMContentLoaded", function () {
  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  loadDirectoryCases();
});

// =====================================
// ADVANCED FILTER: LOAD DROPDOWN OPTIONS
// =====================================

function getReferenceItems(response, possibleKeys) {
  if (Array.isArray(response)) {
    return response;
  }

  for (const key of possibleKeys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }

  return [];
}

function populateFilter(selectId, items, defaultLabel) {
  const select = document.getElementById(selectId);

  if (!select) return;

  select.innerHTML = `<option value="">${defaultLabel}</option>`;

  items.forEach(function (item) {
    const option = document.createElement("option");

    option.value = item.id;

    option.textContent =
      item.name ||
      item.title ||
      item.court_name ||
      item.judge_name ||
      item.short_title ||
      `Item ${item.id}`;

    select.appendChild(option);
  });
}

async function loadFilterOptions() {
  try {
    const [courtResponse, judgeResponse, topicResponse, legislationResponse] =
      await Promise.all([
        CourtAPI.getAll(),
        JudgeAPI.getAll(),
        TopicAPI.getAll(),
        LegislationAPI.getAll(),
      ]);

    const courts = getReferenceItems(courtResponse, ["courts"]);

    const judges = getReferenceItems(judgeResponse, ["judges"]);

    const topics = getReferenceItems(topicResponse, ["topics"]);

    const legislations = getReferenceItems(legislationResponse, [
      "legislation",
      "legislations",
    ]);

    populateFilter("filterCourt", courts, "All Courts");
    populateFilter("filterJudge", judges, "All Judges");
    populateFilter("filterTopic", topics, "All Topics");
    populateFilter("filterLegislation", legislations, "All Legislation");
  } catch (error) {
    console.error("Unable to load filter options:", error);
  }
}

// Load dropdown options when the page opens
document.addEventListener("DOMContentLoaded", function () {
  loadFilterOptions();
});

// =====================================
// ADVANCED FILTER: SEARCH LOGIC
// =====================================

const applyFiltersButton = document.getElementById("applyFiltersButton");
const clearFiltersButton = document.getElementById("clearFiltersButton");

function getSelectedFilters() {
  return {
    court_id: document.getElementById("filterCourt").value,
    judge_id: document.getElementById("filterJudge").value,
    topic_id: document.getElementById("filterTopic").value,
    legislation_id: document.getElementById("filterLegislation").value,
    year: document.getElementById("filterYear").value.trim(),
  };
}

if (applyFiltersButton) {
    applyFiltersButton.addEventListener("click", function () {
        currentFilters = getSelectedFilters();

        currentPage = 1;

        loadDirectoryCases();
    });
}

if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", function () {
    document.getElementById("filterCourt").value = "";
    document.getElementById("filterJudge").value = "";
    document.getElementById("filterTopic").value = "";
    document.getElementById("filterLegislation").value = "";
    document.getElementById("filterYear").value = "";

    currentSearchTerm = "";
    currentFilters = {};
    caseSearchInput.value = "";
    currentPage = 1;

    loadDirectoryCases();
  });
}

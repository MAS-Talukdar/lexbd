
const caseSelect = document.getElementById("caseSelect");
const judgesContainer = document.getElementById("judgesContainer");
const topicsContainer = document.getElementById("topicsContainer");
const legislationContainer = document.getElementById("legislationContainer");
const pageMessage = document.getElementById("pageMessage");

let judges = [];
let topics = [];
let legislations = [];
let sections = [];

let selectedRelations = {
    judges: [],
    topics: [],
    legislation: []
};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showMessage(message, type = "success") {
    pageMessage.textContent = message;
    pageMessage.className = "mb-6 p-4 rounded-lg text-sm";

    pageMessage.classList.add(
        type === "success"
            ? "bg-green-100"
            : "bg-red-100"
    );

    pageMessage.classList.add(
        type === "success"
            ? "text-green-800"
            : "text-red-800"
    );
}

function hideMessage() {
    pageMessage.classList.add("hidden");
}

async function initializePage() {
    try {
        const auth = await AuthAPI.getCurrentUser();

        if (
            !auth.user ||
            !["admin", "editor"].includes(auth.user.role)
        ) {
            window.location.href = "./login.html";
            return;
        }

        await loadReferenceData();
        await loadCases();

    } catch (error) {
        window.location.href = "./login.html";
    }
}

async function loadReferenceData() {
    const [judgeResponse, topicResponse, legislationResponse] =
        await Promise.all([
            JudgeAPI.getAll(),
            TopicAPI.getAll(),
            LegislationAPI.getAll()
        ]);

    judges = judgeResponse.judges || [];
    topics = topicResponse.topics || [];
    legislations = legislationResponse.legislation || [];

    // Section endpoint will be connected in the next backend step.
}

async function loadCases() {
    const response = await apiRequest("/admin/cases?page=1&limit=100");

    if (!response.success) {
        throw new Error(response.message || "Unable to load cases.");
    }

    const cases = response.cases || [];

    caseSelect.innerHTML = `
        <option value="">Choose a case</option>
        ${cases.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.title)}
                ${item.citation ? ` - ${escapeHTML(item.citation)}` : ""}
            </option>
        `).join("")}
    `;
}

function renderCheckboxes(container, items, field, selectedIds) {
    if (!items.length) {
        container.innerHTML = `
            <p class="text-sm text-slate-500">No records available.</p>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const id = Number(item.id);
        const checked = selectedIds.includes(id);

        return `
            <label class="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                    type="checkbox"
                    class="relation-checkbox"
                    data-field="${field}"
                    value="${id}"
                    ${checked ? "checked" : ""}
                >
                <span class="text-sm">
                    ${escapeHTML(item.name || item.title)}
                </span>
            </label>
        `;
    }).join("");
}

function renderLegislationRows(existingRelations = []) {
    if (!legislations.length) {
        legislationContainer.innerHTML = `
            <p class="text-sm text-slate-500">No legislation records available.</p>
        `;
        return;
    }

    legislationContainer.innerHTML = "";

    const rows = existingRelations.length
        ? existingRelations
        : [{ legislation_id: "", section_id: "" }];

    rows.forEach(relation => {
        addLegislationRow(
            relation.legislation_id,
            relation.section_id
        );
    });
}

function addLegislationRow(legislationId = "", sectionId = "") {
    const row = document.createElement("div");

    row.className = "grid grid-cols-1 md:grid-cols-3 gap-3 mb-3";

    row.innerHTML = `
        <select class="legislation-select border rounded-lg p-3 bg-white">
            <option value="">Select legislation</option>
            ${legislations.map(item => `
                <option value="${Number(item.id)}"
                    ${Number(legislationId) === Number(item.id) ? "selected" : ""}>
                    ${escapeHTML(item.name || item.title)}
                </option>
            `).join("")}
        </select>

        <select class="section-select border rounded-lg p-3 bg-white"
                data-selected-section="${escapeHTML(sectionId)}"
                disabled>
            <option value="">Select legislation first</option>
        </select>

        <button type="button"
                class="remove-legislation border border-red-300 text-red-600 rounded-lg p-3 hover:bg-red-50">
            Remove
        </button>
    `;

    legislationContainer.appendChild(row);

    const legislationSelect = row.querySelector(".legislation-select");
    const sectionSelect = row.querySelector(".section-select");

    legislationSelect.addEventListener("change", () => {
        loadSectionsForRow(row, "");
    });

    row.querySelector(".remove-legislation")
        .addEventListener("click", () => row.remove());

    if (legislationId) {
        loadSectionsForRow(row, sectionId);
    }
}

async function loadSectionsForRow(row, selectedSectionId) {
    const legislationId = row.querySelector(".legislation-select").value;
    const sectionSelect = row.querySelector(".section-select");

    sectionSelect.innerHTML = `<option value="">Loading sections...</option>`;
    sectionSelect.disabled = true;

    if (!legislationId) {
        sectionSelect.innerHTML = `<option value="">Select legislation first</option>`;
        return;
    }

    try {
        const response = await apiRequest(
            `/legislation/${encodeURIComponent(legislationId)}/sections`
        );

        const availableSections = response.sections || [];

        sectionSelect.innerHTML = `
            <option value="">Select section</option>
            ${availableSections.map(section => `
                <option value="${Number(section.id)}"
                    ${Number(selectedSectionId) === Number(section.id) ? "selected" : ""}>
                    ${escapeHTML(section.section_label)}
                </option>
            `).join("")}
        `;

        sectionSelect.disabled = false;

    } catch (error) {
        sectionSelect.innerHTML = `<option value="">Unable to load sections</option>`;
        showMessage(error.message, "error");
    }
}

async function loadExistingRelations(caseId) {
    const response = await apiRequest(
        `/admin/cases/${encodeURIComponent(caseId)}/relations`
    );

    if (!response.success) {
        throw new Error(response.message || "Unable to load relations.");
    }

    selectedRelations = response.relations;

    renderCheckboxes(
        judgesContainer,
        judges,
        "judges",
        selectedRelations.judges
    );

    renderCheckboxes(
        topicsContainer,
        topics,
        "topics",
        selectedRelations.topics
    );

    renderLegislationRows(selectedRelations.legislation);
}

function collectCheckedIds(field) {
    return Array.from(
        document.querySelectorAll(
            `.relation-checkbox[data-field="${field}"]:checked`
        )
    ).map(input => Number(input.value));
}

function collectLegislationRelations() {
    const relations = [];

    const rows = legislationContainer.querySelectorAll(
        ".grid"
    );

    rows.forEach(row => {
        const legislationId = Number(
            row.querySelector(".legislation-select")?.value
        );

        const sectionId = Number(
            row.querySelector(".section-select")?.value
        );

        // Ignore completely empty rows.
        if (!legislationId && !sectionId) return;

        if (!legislationId || !sectionId) {
            throw new Error(
                "Please select both legislation and section, or remove the empty row."
            );
        }

        relations.push({
            legislation_id: legislationId,
            section_id: sectionId
        });
    });

    const unique = new Set(
        relations.map(item => `${item.legislation_id}-${item.section_id}`)
    );

    if (unique.size !== relations.length) {
        throw new Error("Duplicate legislation sections are not allowed.");
    }

    return relations;
}

async function saveRelations() {
    const caseId = caseSelect.value;

    if (!caseId) {
        showMessage("Please select a case first.", "error");
        return;
    }

    const button = document.getElementById("saveRelationsButton");

    let payload;

    try {
        payload = {
            judges: collectCheckedIds("judges"),
            topics: collectCheckedIds("topics"),
            legislation: collectLegislationRelations()
        };

    } catch (error) {
        showMessage(error.message, "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await apiRequest(
            `/admin/cases/${encodeURIComponent(caseId)}/relations`,
            {
                method: "PUT",
                body: JSON.stringify(payload)
            }
        );

        if (!response.success) {
            throw new Error(response.message || "Unable to save relations.");
        }

        showMessage("Case relationships saved successfully.");
        await loadExistingRelations(caseId);

    } catch (error) {
        showMessage(error.message, "error");

    } finally {
        button.disabled = false;
        button.textContent = "Save Relationships";
    }
}

caseSelect.addEventListener("change", async () => {
    hideMessage();

    if (!caseSelect.value) {
        judgesContainer.innerHTML = "";
        topicsContainer.innerHTML = "";
        legislationContainer.innerHTML = "";
        return;
    }

    try {
        await loadExistingRelations(caseSelect.value);
    } catch (error) {
        showMessage(error.message, "error");
    }
});

document.getElementById("addLegislationButton")
    .addEventListener("click", () => addLegislationRow());

document.getElementById("saveRelationsButton")
    .addEventListener("click", saveRelations);

document.getElementById("reloadRelationsButton")
    .addEventListener("click", async () => {
        if (!caseSelect.value) {
            showMessage("Please select a case first.", "error");
            return;
        }

        try {
            await loadExistingRelations(caseSelect.value);
            showMessage("Existing relationships reloaded.");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

document.getElementById("logoutButton")
    .addEventListener("click", async () => {
        try {
            await AuthAPI.logout();
        } finally {
            window.location.href = "./login.html";
        }
    });

document.addEventListener("DOMContentLoaded", initializePage);

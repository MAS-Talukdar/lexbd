
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

function setText(id, value) {
    document.getElementById(id).textContent =
        value === null || value === undefined || value === ""
            ? "—"
            : value;
}

function renderJudges(judges = []) {
    const container = document.getElementById("caseJudges");

    if (!judges.length) {
        container.textContent = "No judge information available.";
        return;
    }

    container.innerHTML = judges.map(judge =>
        `<span class="inline-block mr-2 mb-2">${escapeHTML(judge.name)}</span>`
    ).join("");
}

function renderTopics(topics = []) {
    const container = document.getElementById("caseTopics");

    if (!topics.length) {
        container.textContent = "No legal topics available.";
        return;
    }

    container.innerHTML = topics.map(topic => `
        <span class="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm">
            ${escapeHTML(topic.name)}
        </span>
    `).join("");
}

function renderLegislation(items = []) {
    const container = document.getElementById("caseLegislation");

    if (!items.length) {
        container.textContent = "No legislation information available.";
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 class="font-semibold text-[#001233]">
                ${escapeHTML(item.legislation_title)}
            </h3>

            <p class="text-sm text-slate-600 mt-2">
                ${escapeHTML(item.section_label || "Section not specified")}
                ${item.section_title
                    ? " — " + escapeHTML(item.section_title)
                    : ""}
            </p>
        </div>
    `).join("");
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB");
}

function showError(message) {
    document.getElementById("caseLoading").classList.add("hidden");

    const errorBox = document.getElementById("caseError");
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

async function loadCaseDetails() {
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get("id");

    if (!caseId || !/^\d+$/.test(caseId)) {
        showError("Invalid case ID.");
        return;
    }

    try {
        const response = await CaseAPI.getCaseDetails(caseId);

        if (!response.success || !response.case) {
            throw new Error("Case details could not be loaded.");
        }

        const caseData = response.case;

        document.title = `${caseData.title || "Case Details"} | LEXBD`;

        setText("caseTitle", caseData.title);
        setText("caseNumber", caseData.case_number);
        setText("caseCitation", caseData.citation);
        setText("caseCourt", caseData.court_name);
        setText("caseDate", formatDate(caseData.decision_date));
        setText("caseYear", caseData.decision_year);
        setText("casePetitioner", caseData.petitioner);
        setText("caseRespondent", caseData.respondent);
        setText("caseJudgment", caseData.judgment_text);

        renderJudges(caseData.judges || []);
        renderTopics(caseData.topics || []);
        renderLegislation(caseData.legislation || []);

        if (caseData.source_url) {
            const source = document.getElementById("caseSource");
            source.href = caseData.source_url;
            document.getElementById("caseSourceSection")
                .classList.remove("hidden");
        }

        if (caseData.pdf_url) {
            const pdf = document.getElementById("casePdf");
            pdf.href = caseData.pdf_url;
            document.getElementById("casePdfSection")
                .classList.remove("hidden");
        }

        document.getElementById("caseLoading").classList.add("hidden");
        document.getElementById("caseContent").classList.remove("hidden");

    } catch (error) {
        console.error("Case Details Error:", error);
        showError(error.message || "Unable to load case details.");
    }
}

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

document.addEventListener("DOMContentLoaded", loadCaseDetails);

const classificationForm = document.getElementById("classificationForm");
const classificationId = document.getElementById("classificationId");
const classificationType = document.getElementById("classificationType");
const parentSubjectContainer = document.getElementById(
  "parentSubjectContainer",
);
const parentSubject = document.getElementById("parentSubject");
const classificationName = document.getElementById("classificationName");
const classificationDescription = document.getElementById(
  "classificationDescription",
);
const classificationsTableBody = document.getElementById(
  "classificationsTableBody",
);
const pageMessage = document.getElementById("pageMessage");
const formTitle = document.getElementById("formTitle");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

let classifications = [];

function showMessage(message, type = "success") {
  pageMessage.textContent = message;
  pageMessage.className = "mb-5 p-3 rounded text-sm";

  if (type === "error") {
    pageMessage.classList.add("bg-red-100", "text-red-700");
  } else {
    pageMessage.classList.add("bg-green-100", "text-green-700");
  }

  pageMessage.classList.remove("hidden");
}

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

async function loadClassifications() {
  classificationsTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="p-5 text-center text-gray-500">
                Loading...
            </td>
        </tr>
    `;

  try {
    const response = await apiRequest("/admin/classifications");

    if (!response.success) {
      throw new Error(response.message || "Could not load classifications");
    }

    classifications = response.classifications || [];

    renderClassifications();
    populateParentSubjects();
  } catch (error) {
    classificationsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-5 text-center text-red-600">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
  }
}

function renderClassifications() {
  if (!classifications.length) {
    classificationsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-5 text-center text-gray-500">
                    No classifications found.
                </td>
            </tr>
        `;
    return;
  }

  const subjects = classifications.filter((item) => item.parent_id === null);

  classificationsTableBody.innerHTML = classifications
    .map((item) => {
      const isSubject = item.parent_id === null;

      const parent = isSubject
        ? null
        : subjects.find(
            (subject) => String(subject.id) === String(item.parent_id),
          );

      const status = item.is_active
        ? `<span class="text-green-700 bg-green-100 px-2 py-1 rounded">Active</span>`
        : `<span class="text-red-700 bg-red-100 px-2 py-1 rounded">Inactive</span>`;

      return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-medium">
                    ${escapeHTML(item.name)}
                </td>

                <td class="p-3">
                    ${isSubject ? "Legal Subject" : "Legal Topic"}
                </td>

                <td class="p-3">
                    ${parent ? escapeHTML(parent.name) : "—"}
                </td>

                <td class="p-3">
                    ${status}
                </td>

                <td class="p-3">
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            data-action="edit"
                            data-id="${item.id}"
                            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
                            Edit
                        </button>

                        <button
                            type="button"
                            data-action="toggle"
                            data-id="${item.id}"
                            data-active="${item.is_active}"
                            class="${
                              item.is_active
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-green-600 hover:bg-green-700"
                            } text-white px-3 py-1 rounded">
                            ${item.is_active ? "Deactivate" : "Activate"}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    })
    .join("");
}

function populateParentSubjects(selectedId = "") {
  const subjects = classifications.filter((item) => item.parent_id === null);

  parentSubject.innerHTML = `
        <option value="">Select a Subject</option>
        ${subjects
          .map(
            (subject) => `
            <option
                value="${subject.id}"
                ${String(subject.id) === String(selectedId) ? "selected" : ""}
                ${!subject.is_active && String(subject.id) !== String(selectedId) ? "disabled" : ""}
            >
                ${escapeHTML(subject.name)}${subject.is_active ? "" : " (Inactive)"}
            </option>
        `,
          )
          .join("")}
    `;
}

function updateClassificationType() {
  const isTopic = classificationType.value === "topic";

  parentSubjectContainer.classList.toggle("hidden", !isTopic);
  parentSubject.required = isTopic;
}

function resetForm() {
  classificationForm.reset();

  classificationId.value = "";
  classificationType.disabled = false;
  classificationType.value = "subject";

  parentSubject.disabled = false;
  parentSubject.value = "";

  classificationName.value = "";
  classificationDescription.value = "";

  formTitle.textContent = "Create New Classification";
  saveButton.textContent = "Save Classification";

  cancelEditButton.classList.add("hidden");

  updateClassificationType();
}

function editClassification(id) {
  const item = classifications.find(
    (classification) => String(classification.id) === String(id),
  );

  if (!item) {
    showMessage("Classification not found.", "error");
    return;
  }

  classificationId.value = item.id;

  classificationType.value = item.parent_id === null ? "subject" : "topic";

  classificationType.disabled = true;

  parentSubject.disabled = true;
  populateParentSubjects(item.parent_id);

  classificationName.value = item.name || "";
  classificationDescription.value = item.description || "";

  formTitle.textContent = "Edit Classification";
  saveButton.textContent = "Update Classification";

  cancelEditButton.classList.remove("hidden");

  updateClassificationType();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

async function saveClassification(event) {
  event.preventDefault();

  const id = classificationId.value;

  const payload = {
    name: classificationName.value.trim(),
    description: classificationDescription.value.trim() || null,
  };

  if (!payload.name) {
    showMessage("Classification name is required.", "error");
    return;
  }

  if (!id && classificationType.value === "topic") {
    if (!parentSubject.value) {
      showMessage("Please select a parent Subject.", "error");
      return;
    }

    payload.parent_id = Number(parentSubject.value);
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const response = await apiRequest(
      id ? `/admin/classifications/${id}` : "/admin/classifications",
      {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      },
    );

    if (!response.success) {
      throw new Error(response.message || "Could not save classification");
    }

    showMessage(
      id
        ? "Classification updated successfully."
        : "Classification created successfully.",
    );

    resetForm();
    await loadClassifications();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = classificationId.value
      ? "Update Classification"
      : "Save Classification";
  }
}

async function toggleClassification(id, currentlyActive) {
  const action = currentlyActive ? "deactivate" : "activate";

  const confirmed = window.confirm(
    `Are you sure you want to ${action} this classification?`,
  );

  if (!confirmed) return;

  try {
    const response = await apiRequest(`/admin/classifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_active: !currentlyActive,
      }),
    });

    if (!response.success) {
      throw new Error(response.message || "Status update failed");
    }

    showMessage(`Classification ${action}d successfully.`);
    await loadClassifications();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

classificationsTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    editClassification(id);
  }

  if (action === "toggle") {
    toggleClassification(id, button.dataset.active === "true");
  }
});

classificationType.addEventListener("change", updateClassificationType);

classificationForm.addEventListener("submit", saveClassification);

cancelEditButton.addEventListener("click", resetForm);

refreshButton.addEventListener("click", loadClassifications);

logoutButton.addEventListener("click", async () => {
  try {
    await AuthAPI.logout();
    window.location.href = "./login.html";
  } catch (error) {
    showMessage("Logout failed. Please try again.", "error");
  }
});

async function initializePage() {
  try {
    const user = await AuthAPI.getCurrentUser();

    if (!user || user.role !== "admin") {
      window.location.href = "./login.html";
      return;
    }

    updateClassificationType();
    await loadClassifications();
  } catch (error) {
    window.location.href = "./login.html";
  }
}

initializePage();

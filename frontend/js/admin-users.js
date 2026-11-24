
const usersTableBody = document.getElementById("usersTableBody");
const editorsTableBody = document.getElementById("editorsTableBody");

const userMessage = document.getElementById("userMessage");

const editorPanel = document.getElementById("editorPanel");
const userPanel = document.getElementById("userPanel");

const showEditorsTab = document.getElementById("showEditorsTab");
const showUsersTab = document.getElementById("showUsersTab");

const createUserSection = document.getElementById("createUserSection");
const createUserForm = document.getElementById("createUserForm");

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userPassword = document.getElementById("userPassword");

const formTitle = document.getElementById("formTitle");
const formRoleDescription = document.getElementById("formRoleDescription");

const createUserButton = document.getElementById("createUserButton");

let currentRole = "editor";


// ================================
// 1. HTML SECURITY
// ================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
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


// ================================
// 2. MESSAGE
// ================================

function showUserMessage(message, type = "success") {
    userMessage.textContent = message;

    userMessage.className =
        type === "error"
            ? "text-red-600"
            : "text-green-600";

    userMessage.classList.remove("hidden");
}

function hideUserMessage() {
    userMessage.textContent = "";
    userMessage.classList.add("hidden");
}


// ================================
// 3. ACCOUNT STATUS
// ================================

function getStatusBadge(isActive) {
    if (isActive) {
        return `
            <span class="px-3 py-1 rounded-full text-xs
                         bg-green-100 text-green-700">
                Active
            </span>
        `;
    }

    return `
        <span class="px-3 py-1 rounded-full text-xs
                     bg-red-100 text-red-700">
            Inactive
        </span>
    `;
}


// ================================
// 4. RENDER USERS
// ================================

function renderUsers(users, role) {
    const tableBody =
        role === "editor"
            ? editorsTableBody
            : usersTableBody;

    if (!Array.isArray(users) || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-6 text-gray-500">
                    No ${role === "editor" ? "editors" : "users"} found.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = users.map((user) => {
        const id = escapeHTML(user.id);
        const name = escapeHTML(user.name);
        const email = escapeHTML(user.email);
        const isActive = user.is_active === true;

        return `
            <tr class="border-b border-gray-200">

                <td class="px-4 py-3">
                    ${name}
                </td>

                <td class="px-4 py-3">
                    ${email}
                </td>

                <td class="px-4 py-3">
                    ${getStatusBadge(isActive)}
                </td>

                <td class="px-4 py-3">
                    <button
                        type="button"
                        class="status-button px-3 py-2 rounded text-sm
                               ${isActive
                                   ? "bg-red-100 text-red-700"
                                   : "bg-green-100 text-green-700"}"
                        data-id="${id}"
                        data-active="${isActive}"
                        data-role="${role}"
                    >
                        ${isActive ? "Deactivate" : "Activate"}
                    </button>
                </td>

            </tr>
        `;
    }).join("");
}


// ================================
// 5. LOAD USERS
// ================================

async function loadUsers(role) {
    const tableBody =
        role === "editor"
            ? editorsTableBody
            : usersTableBody;

    const totalElement =
        role === "editor"
            ? document.getElementById("totalEditors")
            : document.getElementById("totalUsers");

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-6">
                Loading...
            </td>
        </tr>
    `;

    try {
        const response = await apiRequest(
            `/admin/users?role=${encodeURIComponent(role)}`
        );

        const users = response.users || [];

        renderUsers(users, role);

        totalElement.textContent = users.length;

    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-6 text-red-600">
                    Could not load ${role} list.
                </td>
            </tr>
        `;

        showUserMessage(error.message, "error");
    }
}


// ================================
// 6. SWITCH TABS
// ================================

function showEditors() {
    editorPanel.classList.remove("hidden");
    userPanel.classList.add("hidden");

    showEditorsTab.classList.add("bg-gray-900", "text-white");
    showUsersTab.classList.remove("bg-gray-900", "text-white");

    hideCreateForm();
    hideUserMessage();

    loadUsers("editor");
}

function showUsers() {
    userPanel.classList.remove("hidden");
    editorPanel.classList.add("hidden");

    showUsersTab.classList.add("bg-gray-900", "text-white");
    showEditorsTab.classList.remove("bg-gray-900", "text-white");

    hideCreateForm();
    hideUserMessage();

    loadUsers("user");
}


// ================================
// 7. OPEN CREATE FORM
// ================================

function openCreateForm(role) {
    currentRole = role;

    hideUserMessage();

    createUserForm.reset();

    createUserSection.classList.remove("hidden");

    if (role === "editor") {
        formTitle.textContent = "Create New Editor";

        formRoleDescription.textContent =
            "Create an account for a Case Editor.";
    } else {
        formTitle.textContent = "Create New User";

        formRoleDescription.textContent =
            "Create an ordinary user account.";
    }

    createUserButton.disabled = false;
    createUserButton.textContent = "Create Account";
}


// ================================
// 8. CLOSE CREATE FORM
// ================================

function hideCreateForm() {
    createUserSection.classList.add("hidden");
    createUserForm.reset();
}


// ================================
// 9. CREATE EDITOR / USER
// ================================

async function createUser(event) {
    event.preventDefault();

    hideUserMessage();

    const name = userName.value.trim();
    const email = userEmail.value.trim();
    const password = userPassword.value;

    if (!name || !email || !password) {
        showUserMessage("Please fill in all fields.", "error");
        return;
    }

    if (password.length < 12) {
        showUserMessage(
            "Password must contain at least 12 characters.",
            "error"
        );
        return;
    }

    if (new TextEncoder().encode(password).length > 72) {
        showUserMessage(
            "Password cannot exceed 72 bytes.",
            "error"
        );
        return;
    }

    createUserButton.disabled = true;
    createUserButton.textContent = "Creating...";

    try {
        const response = await apiRequest("/admin/users", {
            method: "POST",
            body: JSON.stringify({
                name,
                email,
                password,
                role: currentRole
            })
        });

        hideCreateForm();

        showUserMessage(
            response.message ||
            `${currentRole === "editor" ? "Editor" : "User"} created successfully.`
        );

        await loadUsers(currentRole);

    } catch (error) {
        showUserMessage(error.message, "error");

    } finally {
        createUserButton.disabled = false;
        createUserButton.textContent = "Create Account";
    }
}


// ================================
// 10. ACTIVATE / DEACTIVATE
// ================================

async function changeUserStatus(userId, isActive, role) {
    const action = isActive ? "deactivate" : "activate";

    const confirmed = confirm(
        `Are you sure you want to ${action} this ${role}?`
    );

    if (!confirmed) return;

    hideUserMessage();

    try {
        const response = await apiRequest(
            `/admin/users/${encodeURIComponent(userId)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    is_active: !isActive
                })
            }
        );

        showUserMessage(
            response.message ||
            `${role} account ${action}d successfully.`
        );

        await loadUsers(role);

    } catch (error) {
        showUserMessage(error.message, "error");
    }
}


// ================================
// 11. TABLE BUTTON EVENTS
// ================================

document.addEventListener("click", (event) => {
    const button = event.target.closest(".status-button");

    if (!button) return;

    const userId = button.dataset.id;
    const isActive = button.dataset.active === "true";
    const role = button.dataset.role;

    changeUserStatus(userId, isActive, role);
});


// ================================
// 12. INITIALIZE
// ================================

async function initializeAdminUsers() {
    try {
        const response = await AuthAPI.getCurrentUser();

        const currentUser = response.user;

        if (!currentUser || currentUser.role !== "admin") {
            window.location.href = "login.html";
            return;
        }

        showEditors();

    } catch (error) {
        window.location.href = "login.html";
    }
}


// ================================
// 13. EVENT LISTENERS
// ================================

showEditorsTab.addEventListener("click", showEditors);
showUsersTab.addEventListener("click", showUsers);

document.getElementById("createEditorButton")
    .addEventListener("click", () => openCreateForm("editor"));

document.getElementById("createOrdinaryUserButton")
    .addEventListener("click", () => openCreateForm("user"));

document.getElementById("refreshEditors")
    .addEventListener("click", () => loadUsers("editor"));

document.getElementById("refreshUsers")
    .addEventListener("click", () => loadUsers("user"));

document.getElementById("closeCreateForm")
    .addEventListener("click", hideCreateForm);

document.getElementById("cancelCreateForm")
    .addEventListener("click", hideCreateForm);

createUserForm.addEventListener("submit", createUser);


// ================================
// 14. LOGOUT
// ================================

document.getElementById("logoutButton")
    .addEventListener("click", async () => {

        try {
            await AuthAPI.logout();

        } catch (error) {
            console.error("Logout error:", error.message);

        } finally {
            window.location.href = "login.html";
        }
    });


// START
document.addEventListener(
    "DOMContentLoaded",
    initializeAdminUsers
);

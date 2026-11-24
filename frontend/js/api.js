
const API_BASE_URL = "http://127.0.0.1:5000/api";

/**
 * Common API request function
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response");
    }

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed with status ${response.status}`
      );
    }

    return data;

  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
}


/**
 * Public Case APIs
 */
const CaseAPI = {

  // Get latest published cases
  getLatestCases: (limit = 6) => {
    return apiRequest(
      `/cases?limit=${encodeURIComponent(limit)}`
    );
  },

  // Search published cases
  searchCases: (params = {}) => {
    const query = new URLSearchParams(params);

    return apiRequest(
      `/cases/search?${query.toString()}`
    );
  },

  // Get single case details
  getCaseDetails: (id) => {
    return apiRequest(
      `/cases/${encodeURIComponent(id)}`
    );
  }

};


/**
 * Court APIs
 */
const CourtAPI = {

  getAll: () => apiRequest("/courts")

};


/**
 * Judge APIs
 */
const JudgeAPI = {

  getAll: () => apiRequest("/judges")

};


/**
 * Legal Topic APIs
 */
const TopicAPI = {

  getAll: () => apiRequest("/topics")

};


/**
 * Legislation APIs
 */
const LegislationAPI = {

  getAll: () => apiRequest("/legislation")

};

const AuthAPI = {
    login: (credentials) => apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
    }),

    googleLogin: (credential) => apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential })
    }),

    getCurrentUser: () => apiRequest("/auth/me"),

    logout: () => apiRequest("/auth/logout", {
        method: "POST"
    }),

    changePassword: (passwordData) => apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordData)
    })
};


// =====================================
// Admin User Management APIs
// =====================================

const AdminUserAPI = {

    // Get Editors
    getEditors: () => apiRequest(
        "/admin/users?role=editor"
    ),

    // Get Ordinary Users
    getUsers: () => apiRequest(
        "/admin/users?role=user"
    ),

    // Create Editor or User
    createUser: (userData) => apiRequest(
        "/admin/users",
        {
            method: "POST",
            body: JSON.stringify(userData)
        }
    ),

    // Activate or Deactivate Editor/User
    updateStatus: (userId, isActive) => apiRequest(
        `/admin/users/${encodeURIComponent(userId)}/status`,
        {
            method: "PATCH",
            body: JSON.stringify({
                is_active: isActive
            })
        }
    )

};

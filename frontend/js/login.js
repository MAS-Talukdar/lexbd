const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

document.getElementById("currentYear").textContent = new Date().getFullYear();

function showLoginMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.className = "rounded-lg p-3 text-sm mb-5";

  if (type === "success") {
    loginMessage.classList.add("bg-green-50", "text-green-700");
  } else {
    loginMessage.classList.add("bg-red-50", "text-red-700");
  }
}

// Role-based redirection
function redirectUserByRole(user) {
  if (user.role === "admin") {
    window.location.href = "./admin-dashboard.html";
  } else if (user.role === "editor") {
    window.location.href = "./editor-dashboard.html";
  } else if (user.role === "user") {
    window.location.href = "./user-dashboard.html";
  } else {
    throw new Error("Your account role is not recognized.");
  }
}

// Email and Password Login
loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showLoginMessage("Please enter your email and password.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  try {
    const response = await AuthAPI.login({
      email,
      password,
    });

    if (!response.success || !response.user) {
      throw new Error(response.message || "Login failed.");
    }

    const loggedInUser = response.user;

    showLoginMessage("Login successful. Redirecting...", "success");

    redirectUserByRole(loggedInUser);
  } catch (error) {
    showLoginMessage(error.message || "Unable to sign in.");

    loginButton.disabled = false;
    loginButton.textContent = "Sign In";
  }
});

// Google Login Handler
async function handleGoogleCredential(response) {
  try {
    if (!response || !response.credential) {
      throw new Error("Google authentication failed. Please try again.");
    }

    showLoginMessage("Signing in with Google...", "success");

    const result = await AuthAPI.googleLogin(response.credential);

    if (!result.success || !result.user) {
      throw new Error("Google login failed. Please try again.");
    }

    // Google Login is currently for ordinary users only.
    if (result.user.role !== "user") {
      await AuthAPI.logout();

      throw new Error(
        "Google login is currently available for ordinary user accounts only.",
      );
    }

    showLoginMessage("Google login successful!", "success");

    redirectUserByRole(result.user);
  } catch (error) {
    console.error("Google Login Error:", error);

    showLoginMessage(
      error.message || "Google login failed. Please try again.",
      "error",
    );
  }
}

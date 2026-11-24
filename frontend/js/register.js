document.getElementById("currentYear").textContent = new Date().getFullYear();

const registerForm = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const messageBox = document.getElementById("message");

function showMessage(message, type = "error") {
  messageBox.textContent = message;

  messageBox.className =
    "mb-5 p-3 rounded-lg text-sm " +
    (type === "success"
      ? "bg-green-50 text-green-700 border border-green-200"
      : "bg-red-50 text-red-700 border border-red-200");
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.");
    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "Creating Account...";

  try {
    const response = await AuthAPI.register({
      name,
      email,
      password,
    });

    if (!response.success) {
      throw new Error(response.message || "Registration failed.");
    }

    showMessage(
      "Account created successfully. Redirecting to login...",
      "success",
    );

    registerForm.reset();

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1500);
  } catch (error) {
    showMessage(error.message || "Unable to create account.");
  } finally {
    registerButton.disabled = false;
    registerButton.textContent = "Create Account";
  }
});

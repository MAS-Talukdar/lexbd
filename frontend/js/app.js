
const API_URL = "http://localhost:5000/api";

const connectionStatus = document.getElementById(
  "connection-status"
);

const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) {
      throw new Error("Server response failed");
    }

    const data = await response.json();

    connectionStatus.textContent = data.message;

    connectionStatus.className =
      "mt-3 text-green-600 font-semibold";

  } catch (error) {
    connectionStatus.textContent =
      "Backend connection failed: " + error.message;

    connectionStatus.className =
      "mt-3 text-red-600 font-semibold";
  }
};

checkBackendConnection();

// verify-2fa.js - Two-Factor Authentication Verification

let countdownInterval;
let adminEmail = "";
let adminUid = "";

// Check if user came from login page
window.addEventListener("DOMContentLoaded", function () {
  // Get email and UID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  adminEmail = urlParams.get("email");
  adminUid = urlParams.get("uid");

  if (!adminEmail || !adminUid) {
    // No email/uid in URL - redirect to login
    alert("Invalid access. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  // Display email
  document.getElementById(
    "emailDisplay"
  ).textContent = `Enter the 6-digit code sent to ${adminEmail}`;

  // Start countdown timer
  startCountdown(300); // 5 minutes = 300 seconds
});

// Handle verification form submission
document
  .getElementById("verify2FAForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const code = document.getElementById("verificationCode").value.trim();
    const verifyBtn = document.getElementById("verifyBtn");
    const successMessage = document.getElementById("successMessage");
    const errorMessage = document.getElementById("errorMessage");

    // Validation
    if (!code || code.length !== 6) {
      showError("Please enter a valid 6-digit code");
      return;
    }

    // Hide messages
    successMessage.classList.add("d-none");
    errorMessage.classList.add("d-none");

    // Show loading state
    verifyBtn.disabled = true;
    verifyBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

    // Verify code from Firestore
    const db = firebase.firestore();

    db.collection("verificationCodes")
      .doc(adminUid)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          showError("Verification code not found. Please request a new code.");
          verifyBtn.disabled = false;
          verifyBtn.innerHTML =
            '<i class="bi bi-shield-check me-2"></i>Verify & Continue';
          return;
        }

        const data = doc.data();
        const storedCode = data.code;
        const expiresAt = data.expiresAt.toDate();
        const now = new Date();

        // Check if code expired
        if (now > expiresAt) {
          showError("Code expired. Please request a new code.");
          verifyBtn.disabled = false;
          verifyBtn.innerHTML =
            '<i class="bi bi-shield-check me-2"></i>Verify & Continue';
          return;
        }

        // Check if code matches
        if (code !== storedCode) {
          showError("Invalid verification code. Please try again.");
          verifyBtn.disabled = false;
          verifyBtn.innerHTML =
            '<i class="bi bi-shield-check me-2"></i>Verify & Continue';
          return;
        }

        // Code is valid! Update last 2FA verification time
        db.collection("users")
          .doc(adminUid)
          .update({
            last2FAVerification:
              firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            // Delete used verification code
            db.collection("verificationCodes").doc(adminUid).delete();

            // Show success message
            successMessage.classList.remove("d-none");
            clearInterval(countdownInterval);

            // Log activity
            logActivity("2fa_verified", adminEmail);

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              window.location.href = "dashboard.html";
            }, 2000);
          })
          .catch((error) => {
            console.error("Error updating user:", error);
            showError("An error occurred. Please try again.");
            verifyBtn.disabled = false;
            verifyBtn.innerHTML =
              '<i class="bi bi-shield-check me-2"></i>Verify & Continue';
          });
      })
      .catch((error) => {
        console.error("Error verifying code:", error);
        showError("An error occurred. Please try again.");
        verifyBtn.disabled = false;
        verifyBtn.innerHTML =
          '<i class="bi bi-shield-check me-2"></i>Verify & Continue';
      });
  });

// Handle resend code button
document.getElementById("resendBtn").addEventListener("click", function () {
  const resendBtn = document.getElementById("resendBtn");
  resendBtn.disabled = true;
  resendBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

  // Redirect back to login to generate new code
  alert("Redirecting to login page to send a new code...");
  window.location.href = `index.html?resend=true&email=${encodeURIComponent(
    adminEmail
  )}`;
});

// Start countdown timer
function startCountdown(seconds) {
  let timeLeft = seconds;

  countdownInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    document.getElementById("countdown").textContent = `${minutes}:${
      secs < 10 ? "0" : ""
    }${secs}`;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      document.getElementById("countdown").textContent = "Expired";
      document.getElementById("countdown").classList.remove("text-danger");
      document.getElementById("countdown").classList.add("text-muted");

      // Disable verify button
      document.getElementById("verifyBtn").disabled = true;
      document.getElementById("verifyBtn").innerHTML =
        '<i class="bi bi-x-circle me-2"></i>Code Expired';

      showError(
        "Verification code expired. Please click 'Resend Code' to get a new one."
      );
    }

    timeLeft--;
  }, 1000);
}

// Show error message
function showError(message) {
  const errorMessage = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");
  errorText.textContent = message;
  errorMessage.classList.remove("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Log activity
function logActivity(action, email) {
  const db = firebase.firestore();
  db.collection("activityLog")
    .add({
      action: action,
      adminEmail: email,
      description: `Admin verified 2FA code`,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch((error) => {
      console.error("Error logging activity:", error);
    });
}

// Auto-focus and format input
document
  .getElementById("verificationCode")
  .addEventListener("input", function (e) {
    // Only allow numbers
    this.value = this.value.replace(/[^0-9]/g, "");
  });

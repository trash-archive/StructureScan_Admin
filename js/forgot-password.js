// forgot-password.js - Admin-Only Password Reset

// Handle form submission
document
  .getElementById("forgotPasswordForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const resetBtn = document.getElementById("resetBtn");
    const successMessage = document.getElementById("successMessage");
    const errorMessage = document.getElementById("errorMessage");

    // Validation
    if (!email) {
      showError("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      showError("Please enter a valid email address");
      return;
    }

    // Hide messages
    successMessage.classList.add("d-none");
    errorMessage.classList.add("d-none");

    // Show loading state
    resetBtn.disabled = true;
    resetBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Checking...';

    // Check if user exists and is admin in Firestore
    const db = firebase.firestore();

    // Get ALL users and search manually (this ALWAYS works)
    db.collection("users")
      .get()
      .then((snapshot) => {
        let userData = null;
        let foundUser = false;

        // Search through all users for matching email
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log("Checking user:", data.email); // Debug log

          if (data.email === email) {
            userData = data;
            foundUser = true;
            console.log("✅ Found user:", userData); // Debug log
          }
        });

        // Check if user was found
        if (!foundUser || !userData) {
          console.log("❌ User not found");
          showError("No admin account found with this email address.");
          resetBtn.disabled = false;
          resetBtn.innerHTML =
            '<i class="bi bi-envelope me-2"></i>Send Reset Link';
          return;
        }

        // Check if user is admin
        const isUserAdmin =
          userData.isAdmin === true || userData.role === "Admin";

        console.log("User data:", userData);
        console.log("Is admin?", isUserAdmin);

        if (!isUserAdmin) {
          console.log("❌ User is not admin");
          showError(
            "Access denied. This is not an administrator account. Mobile users cannot reset passwords here."
          );
          resetBtn.disabled = false;
          resetBtn.innerHTML =
            '<i class="bi bi-envelope me-2"></i>Send Reset Link';
          return;
        }

        // User is admin - proceed with sending reset email
        console.log("✅ Admin verified, sending reset email...");
        resetBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

        firebase
          .auth()
          .sendPasswordResetEmail(email)
          .then(() => {
            console.log("✅ Reset email sent successfully!");
            // Success - show success message
            successMessage.classList.remove("d-none");
            document.getElementById("email").value = "";

            // Reset button
            resetBtn.disabled = false;
            resetBtn.innerHTML =
              '<i class="bi bi-envelope me-2"></i>Send Reset Link';

            // Scroll to top to show message
            window.scrollTo({ top: 0, behavior: "smooth" });

            // Auto-hide success message after 5 seconds
            setTimeout(() => {
              successMessage.classList.add("d-none");
            }, 5000);
          })
          .catch((error) => {
            console.error("❌ Error sending reset email:", error);

            // Handle specific errors
            let errorMsg = "Failed to send reset email. Please try again.";
            if (error.code === "auth/invalid-email") {
              errorMsg = "Invalid email address format.";
            } else if (error.code === "auth/too-many-requests") {
              errorMsg = "Too many requests. Please try again later.";
            }

            showError(errorMsg);

            // Reset button
            resetBtn.disabled = false;
            resetBtn.innerHTML =
              '<i class="bi bi-envelope me-2"></i>Send Reset Link';
          });
      })
      .catch((error) => {
        console.error("❌ Error checking user:", error);
        showError(
          "An error occurred while verifying account. Please try again."
        );

        resetBtn.disabled = false;
        resetBtn.innerHTML =
          '<i class="bi bi-envelope me-2"></i>Send Reset Link';
      });
  });

// Show error message
function showError(message) {
  const errorMessage = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");
  const emailField = document.getElementById("email");

  errorText.textContent = message;
  errorMessage.classList.remove("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto-clear email field after showing error
  setTimeout(() => {
    emailField.value = "";
  }, 500);

  // Auto-hide error message after 5 seconds
  setTimeout(() => {
    errorMessage.classList.add("d-none");
  }, 5000);
}

// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

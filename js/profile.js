// profile.js - Admin Profile Page

// Global variable to store current user data
let currentUserData = null;

// Check if user is logged in and is admin
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  db.collection("users")
    .doc(user.uid)
    .get()
    .then((doc) => {
      if (!doc.exists || !doc.data().isAdmin) {
        alert("Access denied. Admin only.");
        firebase.auth().signOut();
        window.location.href = "index.html";
        return;
      }
      // Load profile data
      loadProfileData(user, doc.data());
    })
    .catch((error) => {
      console.error("Error checking admin status:", error);
      window.location.href = "index.html";
    });
});

// Load profile data
function loadProfileData(user, userData) {
  currentUserData = { user, userData };

  // Avatar initial
  const initial = (userData.fullName || user.email || "A")
    .charAt(0)
    .toUpperCase();
  document.getElementById("profileAvatar").textContent = initial;

  // Profile name and email (top section)
  document.getElementById("profileFullName").textContent =
    userData.fullName || "Admin User";
  document.getElementById("profileEmail").textContent = user.email || "N/A";

  // Role badge
  const roleText = userData.isAdmin ? "System Administrator" : "User";
  document.getElementById("profileRole").textContent = roleText;

  // Profile Details section
  document.getElementById("profileFullName2").textContent =
    userData.fullName || "N/A";
  document.getElementById("profileEmail2").textContent = user.email || "N/A";
  document.getElementById("profileRoleText").textContent = roleText;

  // Account created date
  if (userData.createdAt) {
    const date = userData.createdAt.toDate();
    document.getElementById("profileCreatedDate").textContent =
      formatDate(date);
  } else {
    document.getElementById("profileCreatedDate").textContent = "N/A";
  }

  console.log("Profile loaded successfully");
}

// Format date
function formatDate(date) {
  if (!date || !(date instanceof Date)) return "N/A";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

// Edit profile - opens modal
function editProfile() {
  if (!currentUserData) {
    alert("Profile data not loaded yet");
    return;
  }

  const { user, userData } = currentUserData;

  // Populate modal fields
  const initial = (userData.fullName || user.email || "A")
    .charAt(0)
    .toUpperCase();
  document.getElementById("editProfileAvatar").textContent = initial;
  document.getElementById("editFullName").value = userData.fullName || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editRole").value = userData.isAdmin
    ? "System Administrator"
    : "User";

  if (userData.createdAt) {
    const date = userData.createdAt.toDate();
    document.getElementById("editAccountCreated").value = formatDate(date);
  } else {
    document.getElementById("editAccountCreated").value = "N/A";
  }

  // Show modal
  const modal = new bootstrap.Modal(
    document.getElementById("editProfileModal")
  );
  modal.show();
}

// Save profile changes
async function saveProfileChanges() {
  const fullName = document.getElementById("editFullName").value.trim();
  const newEmail = document.getElementById("editEmail").value.trim();

  // Validation
  if (!fullName) {
    alert("Full name is required");
    return;
  }

  if (!newEmail || !validateEmail(newEmail)) {
    alert("Please enter a valid email address");
    return;
  }

  const user = firebase.auth().currentUser;
  const db = firebase.firestore();

  try {
    // Show loading on button
    const saveBtn = document.getElementById("saveChangesBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

    // Update Firestore
    await db.collection("users").doc(user.uid).update({
      fullName: fullName,
      email: newEmail,
    });

    // Update Firebase Auth email if changed
    if (newEmail !== user.email) {
      await user.updateEmail(newEmail);
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("editProfileModal")
    );
    modal.hide();

    // Log activity
    logActivity("profile_updated", `Admin profile updated: ${fullName}`);

    // Show success toast
    showToast("Profile updated successfully!");

    // Reload profile data
    const updatedDoc = await db.collection("users").doc(user.uid).get();
    loadProfileData(user, updatedDoc.data());

    // Reset button
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Save Changes';
  } catch (error) {
    console.error("Error updating profile:", error);

    let errorMsg = "Failed to update profile";
    if (error.code === "auth/requires-recent-login") {
      errorMsg = "Please log out and log in again to change your email";
    } else if (error.code === "auth/email-already-in-use") {
      errorMsg = "This email is already in use";
    } else if (error.code === "auth/invalid-email") {
      errorMsg = "Invalid email address";
    }

    alert(errorMsg);

    // Re-enable button
    const saveBtn = document.getElementById("saveChangesBtn");
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Save Changes';
  }
}

// Change password - opens modal
function changePassword() {
  // Clear previous input fields
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";

  // Reset password visibility icons to eye (hidden)
  document.getElementById("currentPassword").type = "password";
  document.getElementById("newPassword").type = "password";
  document.getElementById("confirmPassword").type = "password";
  document.getElementById("currentPassword-icon").className = "bi bi-eye";
  document.getElementById("newPassword-icon").className = "bi bi-eye";
  document.getElementById("confirmPassword-icon").className = "bi bi-eye";

  // Show modal
  const modal = new bootstrap.Modal(
    document.getElementById("changePasswordModal")
  );
  modal.show();
}

// Toggle password visibility
function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = document.getElementById(fieldId + "-icon");

  if (field.type === "password") {
    field.type = "text";
    icon.className = "bi bi-eye-slash";
  } else {
    field.type = "password";
    icon.className = "bi bi-eye";
  }
}

// Update password
async function updatePassword() {
  const currentPassword = document
    .getElementById("currentPassword")
    .value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document
    .getElementById("confirmPassword")
    .value.trim();

  // Validation
  if (!currentPassword) {
    alert("Current password is required");
    return;
  }

  if (!newPassword) {
    alert("New password is required");
    return;
  }

  if (!confirmPassword) {
    alert("Please confirm your new password");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New passwords do not match");
    return;
  }

  // Validate password strength
  if (!validatePasswordStrength(newPassword)) {
    alert(
      "Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters (!@#$%^&*)"
    );
    return;
  }

  const user = firebase.auth().currentUser;

  try {
    // Show loading on button
    const updateBtn = document.getElementById("updatePasswordBtn");
    updateBtn.disabled = true;
    updateBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1"></span>Updating...';

    // Re-authenticate user with current password
    const credential = firebase.auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    await user.reauthenticateWithCredential(credential);

    // Update password
    await user.updatePassword(newPassword);

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("changePasswordModal")
    );
    modal.hide();

    // Log activity
    logActivity("password_changed", "Admin password changed successfully");

    // Show success toast
    showToast("Password updated successfully!");

    // Reset button
    updateBtn.disabled = false;
    updateBtn.innerHTML =
      '<i class="bi bi-check-circle me-1"></i>Update Password';
  } catch (error) {
    console.error("Error updating password:", error);

    let errorMsg = "Failed to update password";
    if (error.code === "auth/wrong-password") {
      errorMsg = "Current password is incorrect";
    } else if (error.code === "auth/weak-password") {
      errorMsg = "New password is too weak";
    } else if (error.code === "auth/requires-recent-login") {
      errorMsg = "Please log out and log in again to change your password";
    }

    alert(errorMsg);

    // Re-enable button
    const updateBtn = document.getElementById("updatePasswordBtn");
    updateBtn.disabled = false;
    updateBtn.innerHTML =
      '<i class="bi bi-check-circle me-1"></i>Update Password';
  }
}

// Validate password strength
function validatePasswordStrength(password) {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Show toast notification
function showToast(message) {
  document.getElementById("toastMessage").textContent = message;
  const toastEl = document.getElementById("successToast");
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
}

// Activity logging helper
function logActivity(action, description, additionalData = {}) {
  const db = firebase.firestore();
  const user = firebase.auth().currentUser;

  db.collection("activityLog")
    .add({
      action: action,
      description: description,
      adminEmail: user ? user.email : "Unknown",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ...additionalData,
    })
    .catch((error) => {
      console.error("Error logging activity:", error);
    });
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "index.html";
    });
});

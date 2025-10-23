// Get userId from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const currentUserId = urlParams.get("userId");

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

      if (currentUserId) {
        loadUserData(currentUserId);
      } else {
        alert("No user ID provided");
        window.location.href = "users.html";
      }
    });
});

// Load user data into form
async function loadUserData(userId) {
  const db = firebase.firestore();

  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      alert("User not found");
      window.location.href = "users.html";
      return;
    }

    const userData = userDoc.data();

    // Populate form fields
    document.getElementById("fullName").value = userData.fullName || "";
    document.getElementById("email").value = userData.email || "";
    document.getElementById("role").value = userData.role || "User";

    // Update avatar
    const initials = getInitials(userData.fullName || "User");
    document.getElementById("userAvatar").textContent = initials;

    // Load statistics
    document.getElementById("userId").textContent = userId;

    // Count assessments
    const assessmentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("assessments")
      .get();
    document.getElementById("totalAssessments").textContent =
      assessmentsSnapshot.size;

    // Account created date
    const createdDate = userData.createdAt
      ? formatDate(userData.createdAt.toDate())
      : "N/A";
    document.getElementById("accountCreated").textContent = createdDate;
  } catch (error) {
    console.error("Error loading user:", error);
    alert("Error loading user data");
    window.location.href = "users.html";
  }
}

// Handle form submission
document
  .getElementById("editUserForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const role = document.getElementById("role").value;
    const adminNotes = document.getElementById("adminNotes").value.trim();

    if (!fullName || !email) {
      showToast("Please fill in all required fields", true);
      return;
    }

    const db = firebase.firestore();

    try {
      // Update user document
      await db.collection("users").doc(currentUserId).update({
        fullName: fullName,
        email: email,
        role: role,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Log the activity with admin notes
      const activityDescription = adminNotes
        ? `Updated user profile for ${fullName}. Reason: ${adminNotes}`
        : `Updated user profile for ${fullName}`;

      logActivity("user_updated", activityDescription);

      showToast("User profile updated successfully!", false);

      // Redirect back after 1.5 seconds
      setTimeout(() => {
        window.location.href = `user-details.html?userId=${currentUserId}`;
      }, 1500);
    } catch (error) {
      console.error("Error updating user:", error);
      showToast("Error updating user: " + error.message, true);
    }
  });

// Get initials from name
function getInitials(name) {
  if (!name) return "U";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Format date
function formatDate(date) {
  if (!date || !(date instanceof Date)) return "N/A";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

// Go back to user details
function goBack() {
  window.location.href = `user-details.html?userId=${currentUserId}`;
}

// Toast notification
function showToast(msg, isError = false) {
  const toastElem = document.getElementById("savedToast");
  toastElem.querySelector(".toast-body").innerHTML =
    (isError
      ? '<i class="bi bi-x-circle me-2"></i>'
      : '<i class="bi bi-check-circle me-2"></i>') + msg;
  toastElem.classList.toggle("text-bg-success", !isError);
  toastElem.classList.toggle("text-bg-danger", isError);
  const toast = new bootstrap.Toast(toastElem, { delay: 2500 });
  toast.show();
}

// Log activity
function logActivity(action, description) {
  const db = firebase.firestore();
  const user = firebase.auth().currentUser;

  db.collection("activityLog").add({
    action: action,
    description: description,
    adminEmail: user ? user.email : "Unknown",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
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

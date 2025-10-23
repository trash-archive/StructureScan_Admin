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

      // ✅ Admin info
      const adminData = doc.data();
      const fullName = adminData.fullName || user.displayName || "Administrator";
      const photoURL = adminData.profileImageURL || user.photoURL || null;

      // Update name in header
      document.getElementById("adminName").textContent = fullName;

      // ✅ Update avatar (image or initial)
      const avatarDiv = document.getElementById("adminAvatar");
      if (photoURL) {
        avatarDiv.innerHTML = `<img src="${photoURL}" alt="Profile Picture" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        const initial = fullName.charAt(0).toUpperCase();
        avatarDiv.innerHTML = initial;
        avatarDiv.style.backgroundColor = "#007bff";
        avatarDiv.style.color = "#fff";
        avatarDiv.style.fontWeight = "600";
        avatarDiv.style.fontSize = "18px";
      }

      // ✅ Load dashboard data
      loadDashboardData();
    })
    .catch((error) => {
      console.error("Error checking admin status:", error);
    });
});

// Load dashboard statistics
function loadDashboardData() {
  const db = firebase.firestore();

  // Count total users (excluding admins)
  db.collection("users")
    .get()
    .then((snapshot) => {
      let nonAdminCount = 0;
      snapshot.forEach((doc) => {
        const userData = doc.data();
        if (!userData.isAdmin) nonAdminCount++;
      });
      document.getElementById("totalUsers").textContent = nonAdminCount;
    })
    .catch((error) => {
      console.error("Error counting users:", error);
      document.getElementById("totalUsers").textContent = "0";
    });

  // Count total assessments from all users' subcollections
  let totalAssessments = 0;
  db.collection("users")
    .get()
    .then((usersSnapshot) => {
      const promises = [];
      usersSnapshot.forEach((userDoc) => {
        const promise = db
          .collection("users")
          .doc(userDoc.id)
          .collection("assessments")
          .get()
          .then((assessmentsSnapshot) => {
            totalAssessments += assessmentsSnapshot.size;
          });
        promises.push(promise);
      });
      return Promise.all(promises);
    })
    .then(() => {
      document.getElementById("totalAssessments").textContent = totalAssessments;
    })
    .catch((error) => {
      console.error("Error counting assessments:", error);
      document.getElementById("totalAssessments").textContent = "0";
    });

  // Count recent activity (last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  db.collection("activityLog")
    .where("timestamp", ">=", oneDayAgo)
    .get()
    .then((snapshot) => {
      document.getElementById("recentActivityCount").textContent = snapshot.size;
    })
    .catch((error) => {
      console.error("Error counting recent activity:", error);
      document.getElementById("recentActivityCount").textContent = "0";
    });

  // Load recent activity
  loadRecentActivity();
}

// Load recent activity from Firestore (limited to 5)
function loadRecentActivity() {
  const db = firebase.firestore();
  const activityList = document.getElementById("activityList");

  db.collection("activityLog")
    .orderBy("timestamp", "desc")
    .limit(5)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        activityList.innerHTML = `
          <div class="list-group-item">
            <div class="d-flex align-items-center">
              <i class="bi bi-info-circle text-muted me-2"></i>
              <span class="text-muted">No recent activity</span>
            </div>
          </div>
        `;
        return;
      }

      activityList.innerHTML = "";
      snapshot.forEach((doc) => {
        const activity = doc.data();
        const timeAgo = getTimeAgo(activity.timestamp);
        const icon = getActivityIcon(activity.action);
        const iconColor = getActivityIconColor(activity.action);

        const item = document.createElement("div");
        item.className = "list-group-item";
        item.innerHTML = `
          <div class="d-flex justify-content-between align-items-start">
            <div class="d-flex align-items-start">
              <div class="bg-${iconColor} bg-opacity-10 rounded p-2 me-3">
                <i class="bi ${icon} text-${iconColor}"></i>
              </div>
              <div>
                <p class="mb-1 fw-semibold">${getActivityTitle(activity.action)}</p>
                <small class="text-muted">${activity.description}</small>
              </div>
            </div>
            <small class="text-muted">${timeAgo}</small>
          </div>
        `;
        activityList.appendChild(item);
      });
    })
    .catch((error) => {
      console.error("Error loading activity:", error);
      activityList.innerHTML = `
        <div class="list-group-item">
          <span class="text-danger">
            <i class="bi bi-exclamation-triangle"></i> Error loading activity
          </span>
        </div>
      `;
    });
}

// Helper: Get activity title
function getActivityTitle(action) {
  const titles = {
    user_viewed: "User Viewed",
    user_deleted: "User Deleted",
    user_created: "New User Registered",
    assessment_viewed: "Assessment Viewed",
    assessment_deleted: "Assessment Deleted",
    assessment_added: "New Assessment Submitted",
    login: "Admin Login",
    logout: "Admin Logout",
  };
  return titles[action] || "Activity Recorded";
}

// Helper: Get icon based on action type
function getActivityIcon(action) {
  const icons = {
    user_viewed: "bi-eye-fill",
    user_deleted: "bi-trash-fill",
    user_created: "bi-person-plus-fill",
    assessment_viewed: "bi-file-earmark-text-fill",
    assessment_deleted: "bi-x-circle-fill",
    assessment_added: "bi-file-earmark-plus-fill",
    login: "bi-box-arrow-in-right",
    logout: "bi-box-arrow-right",
  };
  return icons[action] || "bi-circle-fill";
}

// Helper: Get icon color based on action type
function getActivityIconColor(action) {
  const colors = {
    user_viewed: "info",
    user_deleted: "danger",
    user_created: "success",
    assessment_viewed: "primary",
    assessment_deleted: "danger",
    assessment_added: "success",
    login: "success",
    logout: "warning",
  };
  return colors[action] || "secondary";
}

// Helper: Convert timestamp to relative time
function getTimeAgo(timestamp) {
  if (!timestamp) return "Unknown";

  const now = new Date();
  const activityTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now - activityTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Log admin actions to Firestore
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

// Logout button
document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  logActivity("logout", "Admin logged out");
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  });
});

// Sidebar toggle logic
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", function () {
    sidebar.classList.toggle("show");
    sidebarOverlay.classList.toggle("show");
    document.body.style.overflow = sidebar.classList.contains("show") ? "hidden" : "";
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", function () {
    sidebar.classList.remove("show");
    sidebarOverlay.classList.remove("show");
    document.body.style.overflow = "";
  });
}

document.querySelectorAll(".sidebar-custom .nav-link-custom").forEach((link) => {
  link.addEventListener("click", function () {
    if (window.innerWidth <= 992) {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("show");
      document.body.style.overflow = "";
    }
  });
});

window.addEventListener("resize", function () {
  if (window.innerWidth > 992) {
    sidebar.classList.remove("show");
    sidebarOverlay.classList.remove("show");
    document.body.style.overflow = "";
  }
});

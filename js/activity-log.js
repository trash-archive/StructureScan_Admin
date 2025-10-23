// activity-log.js - Activity Log Page with Pagination

let allActivities = []; // Store all activities
let currentPage = 1;
const itemsPerPage = 10;

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
      // Load activities
      loadAllActivities();
    })
    .catch((error) => {
      console.error("Error checking admin status:", error);
      window.location.href = "index.html";
    });
});

// Load all activities
function loadAllActivities() {
  const db = firebase.firestore();
  const loadingState = document.getElementById("loadingState");
  const activityListContainer = document.getElementById(
    "activityListContainer"
  );
  const emptyState = document.getElementById("emptyState");

  db.collection("activityLog")
    .orderBy("timestamp", "desc")
    .get()
    .then((snapshot) => {
      loadingState.style.display = "none";

      if (snapshot.empty) {
        emptyState.style.display = "block";
        return;
      }

      // Store all activities
      allActivities = [];
      snapshot.forEach((doc) => {
        allActivities.push(doc.data());
      });

      // Display first page
      currentPage = 1;
      displayActivities();
      updatePaginationControls();
    })
    .catch((error) => {
      console.error("Error loading activities:", error);
      loadingState.style.display = "none";
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
        <p class="mt-3 text-danger">Error loading activities</p>
      `;
    });
}

// Display activities for current page
function displayActivities() {
  const activityListContainer = document.getElementById(
    "activityListContainer"
  );
  activityListContainer.style.display = "block";
  activityListContainer.innerHTML = "";

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const activitiesToShow = allActivities.slice(startIndex, endIndex);

  activitiesToShow.forEach((activity) => {
    const timeAgo = getTimeAgo(activity.timestamp);
    const icon = getActivityIcon(activity.action);
    const iconColor = getActivityIconColor(activity.action);
    const title = getActivityTitle(activity.action);

    const activityItem = document.createElement("div");
    activityItem.className = "list-group-item";
    activityItem.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex align-items-start flex-grow-1">
          <div class="bg-${iconColor} bg-opacity-10 rounded p-2 me-3">
            <i class="bi ${icon} text-${iconColor} fs-5"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h6 class="mb-1 fw-semibold">${title}</h6>
              <small class="text-muted">${timeAgo}</small>
            </div>
            <p class="mb-1 text-muted small">${
              activity.description || "No description"
            }</p>
            <small class="text-muted">
              <i class="bi bi-person-circle me-1"></i>${
                activity.adminEmail || "Unknown"
              }
            </small>
          </div>
        </div>
      </div>
    `;
    activityListContainer.appendChild(activityItem);
  });
}

// Update pagination controls
function updatePaginationControls() {
  const totalPages = Math.ceil(allActivities.length / itemsPerPage);
  const paginationContainer = document.getElementById("paginationContainer");

  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";

  let paginationHTML = `
    <nav>
      <ul class="pagination mb-0">
        <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
          <a class="page-link" href="#" onclick="changePage(${
            currentPage - 1
          }); return false;">
            <i class="bi bi-chevron-left"></i> Previous
          </a>
        </li>
  `;

  // Show page numbers (max 5 visible)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <li class="page-item ${currentPage === i ? "active" : ""}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>
    `;
  }

  paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
          <a class="page-link" href="#" onclick="changePage(${
            currentPage + 1
          }); return false;">
            Next <i class="bi bi-chevron-right"></i>
          </a>
        </li>
      </ul>
    </nav>
    <div class="ms-3 text-muted small">
      Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
    currentPage * itemsPerPage,
    allActivities.length
  )} of ${allActivities.length} activities
    </div>
  `;

  paginationContainer.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
  const totalPages = Math.ceil(allActivities.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  displayActivities();
  updatePaginationControls();

  // Scroll to top of activity list
  document
    .getElementById("activityListContainer")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

// Refresh activities
function refreshActivities() {
  document.getElementById("loadingState").style.display = "block";
  document.getElementById("activityListContainer").style.display = "none";
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("paginationContainer").style.display = "none";
  loadAllActivities();
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
    profile_updated: "Profile Updated",
    password_changed: "Password Changed",
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
    profile_updated: "bi-pencil-square",
    password_changed: "bi-shield-lock-fill",
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
    profile_updated: "info",
    password_changed: "warning",
    login: "success",
    logout: "warning",
  };
  return colors[action] || "secondary";
}

// Helper: Convert timestamp to relative time
function getTimeAgo(timestamp) {
  if (!timestamp) return "Unknown";

  const now = new Date();
  const activityTime = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);
  const diffMs = now - activityTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Format full date
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
  return `${
    months[activityTime.getMonth()]
  } ${activityTime.getDate()}, ${activityTime.getFullYear()}`;
}

// Logout functionality
document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "index.html";
    });
});

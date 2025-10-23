// USER-DETAILS.JS - Fixed with event delegation

// Pagination settings
const ASSESSMENTS_PER_PAGE = 10;
let currentPage = 1;
let allAssessments = [];
let currentUserId = null;

// Get userId from URL parameter
const urlParams = new URLSearchParams(window.location.search);
currentUserId = urlParams.get("userId");

console.log("USER-DETAILS.JS LOADED - Current User ID:", currentUserId);

// Check if user is logged in and is admin
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Check if user is admin
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

      // Load user details
      if (currentUserId) {
        loadUserDetails(currentUserId);
      } else {
        alert("No user ID provided");
        window.location.href = "users.html";
      }
    });
});

// Load user details
async function loadUserDetails(userId) {
  const db = firebase.firestore();

  try {
    const doc = await db.collection("users").doc(userId).get();

    if (!doc.exists) {
      alert("User not found");
      window.location.href = "users.html";
      return;
    }

    const userData = doc.data();

    // Set user basic info
    const photoUrl =
      userData.photoUrl1 ||
      "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(userData.fullName || "User") +
        "&background=random";

    document.getElementById("userImage").src = photoUrl;
    document.getElementById("userName").textContent =
      userData.fullName || "N/A";
    document.getElementById("userId").textContent = userData.userId || userId;
    document.getElementById("userRole").textContent = userData.role || "User";
    document.getElementById("userEmail").textContent = userData.email || "N/A";

    const status = userData.status || "active";
    document.getElementById("userStatus").innerHTML =
      status === "active"
        ? '<span class="badge bg-success">Active</span>'
        : '<span class="badge bg-warning">Suspended</span>';

    // Load assessments
    const assessmentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("assessments")
      .orderBy("timestamp", "desc")
      .get();

    document.getElementById("userAssessments").textContent =
      assessmentsSnapshot.size;

    allAssessments = [];
    assessmentsSnapshot.forEach((doc) => {
      allAssessments.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    renderAssessments();
    renderPagination();
  } catch (error) {
    console.error("Error loading user:", error);
    alert("Error loading user details");
    window.location.href = "users.html";
  }
}

// Render assessments for current page
function renderAssessments() {
  const tableBody = document.getElementById("assessmentHistoryTable");
  const start = (currentPage - 1) * ASSESSMENTS_PER_PAGE;
  const end = start + ASSESSMENTS_PER_PAGE;
  const assessmentsToShow = allAssessments.slice(start, end);

  if (assessmentsToShow.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4 text-muted">No assessments found</td></tr>';
    return;
  }

  tableBody.innerHTML = "";
  assessmentsToShow.forEach((assessment) => {
    const assessmentName =
      assessment.assessmentName || assessment.buildingType || "Home Assessment";
    const assessmentId = assessment.id;
    const dateSubmitted = assessment.timestamp || assessment.createdAt;
    const formattedDate = dateSubmitted
      ? formatDate(
          dateSubmitted.toDate
            ? dateSubmitted.toDate()
            : new Date(dateSubmitted)
        )
      : "N/A";

    // Calculate issues
    let issuesCount = 0;
    let riskLevel = "Low";

    if (assessment.detectionSummary) {
      const summary = assessment.detectionSummary;

      if (summary.paintDamage) {
        issuesCount += summary.paintDamage.high || 0;
        issuesCount += summary.paintDamage.moderate || 0;
        issuesCount += summary.paintDamage.low || 0;
      }

      if (summary.crackDetection) {
        issuesCount += summary.crackDetection.high || 0;
        issuesCount += summary.crackDetection.moderate || 0;
        issuesCount += summary.crackDetection.low || 0;
      }

      if (summary.algaeMoss) {
        issuesCount += summary.algaeMoss.high || 0;
        issuesCount += summary.algaeMoss.moderate || 0;
        issuesCount += summary.algaeMoss.low || 0;
      }
    }

    if (assessment.issuesFound !== undefined) {
      issuesCount = assessment.issuesFound;
    }

    if (assessment.riskLevel) {
      riskLevel = assessment.riskLevel;
    } else if (assessment.overallRisk) {
      riskLevel = assessment.overallRisk;
    } else {
      if (issuesCount >= 5) {
        riskLevel = "High";
      } else if (issuesCount >= 2) {
        riskLevel = "Medium";
      }
    }

    let riskBadgeClass = "bg-success";
    if (riskLevel.toLowerCase() === "high") {
      riskBadgeClass = "bg-danger";
    } else if (
      riskLevel.toLowerCase() === "medium" ||
      riskLevel.toLowerCase() === "moderate"
    ) {
      riskBadgeClass = "bg-warning";
    }

    const row = `
      <tr>
        <td>
          <strong>${assessmentName}</strong><br>
          <small class="text-muted">${assessmentId}</small>
        </td>
        <td>${formattedDate}</td>
        <td>
          ${
            issuesCount > 0
              ? `<span class="badge bg-danger">${issuesCount} issue${
                  issuesCount > 1 ? "s" : ""
                }</span>`
              : `<span class="badge bg-success">No issues</span>`
          }
        </td>
        <td>
          <span class="badge ${riskBadgeClass}">${riskLevel} Risk</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary view-assessment-btn" data-assessment-id="${assessmentId}">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });

  // Add event listeners to all view buttons using event delegation
  document.querySelectorAll(".view-assessment-btn").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const assessmentId = this.getAttribute("data-assessment-id");
      console.log("Button clicked! Assessment ID:", assessmentId);
      viewAssessmentDetails(assessmentId);
    });
  });

  // Update pagination info
  const totalAssessments = allAssessments.length;
  const showing = assessmentsToShow.length;
  document.getElementById("paginationInfo").textContent = `Showing ${
    start + 1
  }-${start + showing} of ${totalAssessments} assessments`;
}

// Render pagination
function renderPagination() {
  const totalPages = Math.ceil(allAssessments.length / ASSESSMENTS_PER_PAGE);
  const pagination = document.getElementById("pagination");

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";

  // Previous button
  html += `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" onclick="changePage(${
        currentPage - 1
      }); return false;">
        <i class="bi bi-chevron-left"></i>
      </a>
    </li>
  `;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      html += `
        <li class="page-item ${i === currentPage ? "active" : ""}">
          <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
        </li>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  // Next button
  html += `
    <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
      <a class="page-link" href="#" onclick="changePage(${
        currentPage + 1
      }); return false;">
        <i class="bi bi-chevron-right"></i>
      </a>
    </li>
  `;

  pagination.innerHTML = html;
}

// Change page
function changePage(page) {
  const totalPages = Math.ceil(allAssessments.length / ASSESSMENTS_PER_PAGE);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderAssessments();
  renderPagination();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Format date helper
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

// Edit user
function editUser() {
  window.location.href = `edit-user.html?userId=${currentUserId}`;
}

// Global variable to store current user data for modal
let currentUserData = null;

// Load user details - UPDATE THIS FUNCTION
async function loadUserDetails(userId) {
  const db = firebase.firestore();

  try {
    const doc = await db.collection("users").doc(userId).get();

    if (!doc.exists) {
      alert("User not found");
      window.location.href = "users.html";
      return;
    }

    const userData = doc.data();
    currentUserData = userData; // Store for modal use

    // Set user basic info
    const photoUrl =
      userData.photoUrl1 ||
      "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(userData.fullName || "User") +
        "&background=random";

    document.getElementById("userImage").src = photoUrl;
    document.getElementById("userName").textContent =
      userData.fullName || "N/A";
    document.getElementById("userId").textContent = userData.userId || userId;
    document.getElementById("userRole").textContent = userData.role || "User";
    document.getElementById("userEmail").textContent = userData.email || "N/A";

    const status = userData.status || "active";
    const isSuspended = userData.isSuspended || false;

    document.getElementById("userStatus").innerHTML =
      status === "suspended" || isSuspended
        ? '<span class="badge bg-warning">Suspended</span>'
        : '<span class="badge bg-success">Active</span>';

    // Update suspend button text based on current status
    updateSuspendButton(status === "suspended" || isSuspended);

    // Load assessments
    const assessmentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("assessments")
      .orderBy("timestamp", "desc")
      .get();

    document.getElementById("userAssessments").textContent =
      assessmentsSnapshot.size;

    allAssessments = [];
    assessmentsSnapshot.forEach((doc) => {
      allAssessments.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    renderAssessments();
    renderPagination();
  } catch (error) {
    console.error("Error loading user:", error);
    alert("Error loading user details");
    window.location.href = "users.html";
  }
}

// Update suspend button based on user status
function updateSuspendButton(isSuspended) {
  const suspendBtn = document.querySelector('button[onclick="suspendUser()"]');
  if (suspendBtn) {
    if (isSuspended) {
      suspendBtn.innerHTML = '<i class="bi bi-check-circle"></i> Unsuspend';
      suspendBtn.className = "btn btn-success mb-2";
    } else {
      suspendBtn.innerHTML = '<i class="bi bi-pause-circle"></i> Suspend';
      suspendBtn.className = "btn btn-warning mb-2";
    }
  }
}

// Open suspension modal
function suspendUser() {
  const db = firebase.firestore();

  // Check current user status
  db.collection("users")
    .doc(currentUserId)
    .get()
    .then((doc) => {
      const userData = doc.data();
      const isSuspended =
        userData.status === "suspended" || userData.isSuspended;

      // Populate modal with user data
      document.getElementById("suspendUserName").textContent =
        userData.fullName || "N/A";
      document.getElementById("suspendUserEmail").textContent =
        userData.email || "N/A";
      document.getElementById(
        "suspendUserId"
      ).textContent = `USER ID: ${currentUserId}`;

      document.getElementById("unsuspendUserName").textContent =
        userData.fullName || "N/A";
      document.getElementById("unsuspendUserEmail").textContent =
        userData.email || "N/A";

      // Show appropriate content based on current status
      if (isSuspended) {
        // Show unsuspend content
        document.getElementById("suspendModalTitle").textContent =
          "Unsuspend User Account";
        document.getElementById("suspendContent").style.display = "none";
        document.getElementById("unsuspendContent").style.display = "block";
        document.getElementById("confirmBtnText").textContent =
          "Unsuspend User";
        document.getElementById("confirmSuspendBtn").className =
          "btn btn-success px-4";
      } else {
        // Show suspend content
        document.getElementById("suspendModalTitle").textContent =
          "Suspend User Account";
        document.getElementById("suspendContent").style.display = "block";
        document.getElementById("unsuspendContent").style.display = "none";
        document.getElementById("confirmBtnText").textContent = "Suspend User";
        document.getElementById("confirmSuspendBtn").className =
          "btn btn-warning px-4";
      }

      // Clear previous reason
      document.getElementById("suspendReason").value = "";
      document.getElementById("unsuspendReason").value = "";

      // Show modal
      const modal = new bootstrap.Modal(
        document.getElementById("suspendModal")
      );
      modal.show();
    });
}

// Confirm suspend/unsuspend action
function confirmSuspendAction() {
  const db = firebase.firestore();

  db.collection("users")
    .doc(currentUserId)
    .get()
    .then((doc) => {
      const userData = doc.data();
      const isSuspended =
        userData.status === "suspended" || userData.isSuspended;

      if (isSuspended) {
        // Unsuspend user
        const reason = document.getElementById("unsuspendReason").value.trim();

        db.collection("users")
          .doc(currentUserId)
          .update({
            status: "active",
            isSuspended: false,
            unsuspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            const logDescription = reason
              ? `Unsuspended user: ${userData.fullName}. Reason: ${reason}`
              : `Unsuspended user: ${userData.fullName}`;

            logActivity("user_unsuspended", logDescription);

            // Close modal
            bootstrap.Modal.getInstance(
              document.getElementById("suspendModal")
            ).hide();

            showToast("User unsuspended successfully!", false);
            loadUserDetails(currentUserId);
          })
          .catch((error) => {
            showToast("Error unsuspending user: " + error.message, true);
          });
      } else {
        // Suspend user
        const reason = document.getElementById("suspendReason").value.trim();

        db.collection("users")
          .doc(currentUserId)
          .update({
            status: "suspended",
            isSuspended: true,
            suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            const logDescription = reason
              ? `Suspended user: ${userData.fullName}. Reason: ${reason}`
              : `Suspended user: ${userData.fullName}`;

            logActivity("user_suspended", logDescription);

            // Close modal
            bootstrap.Modal.getInstance(
              document.getElementById("suspendModal")
            ).hide();

            showToast("User suspended successfully!", false);
            loadUserDetails(currentUserId);
          })
          .catch((error) => {
            showToast("Error suspending user: " + error.message, true);
          });
      }
    });
}

// Delete user
function deleteUser() {
  if (
    confirm(
      "Are you sure you want to delete this user? This action cannot be undone."
    )
  ) {
    const db = firebase.firestore();
    db.collection("users")
      .doc(currentUserId)
      .delete()
      .then(() => {
        showToast("User deleted successfully!", false);
        logActivity("user_deleted", `Deleted user: ${currentUserId}`);
        setTimeout(() => {
          window.location.href = "users.html";
        }, 1500);
      })
      .catch((error) => {
        showToast("Error deleting user: " + error.message, true);
      });
  }
}

// View assessment details - NOW PROPERLY CALLED
function viewAssessmentDetails(assessmentId) {
  console.log("==========================================");
  console.log("VIEW ASSESSMENT DETAILS FUNCTION CALLED!");
  console.log("Assessment ID:", assessmentId);
  console.log("Current User ID:", currentUserId);
  console.log("==========================================");

  // Log the activity
  logActivity(
    "assessment_viewed",
    `Viewed assessment: ${assessmentId} for user: ${currentUserId}`
  );

  // Store navigation context
  sessionStorage.setItem("returnPage", "user-detail");
  sessionStorage.setItem("returnUserId", currentUserId);

  console.log("Session storage set:");
  console.log("- returnPage:", sessionStorage.getItem("returnPage"));
  console.log("- returnUserId:", sessionStorage.getItem("returnUserId"));

  // Build the URL - MUST BE assessment-details.html
  const targetUrl = `assessment-details.html?userId=${encodeURIComponent(
    currentUserId
  )}&assessmentId=${encodeURIComponent(assessmentId)}`;

  console.log("Target URL:", targetUrl);
  console.log("Navigating to assessment-details.html...");
  console.log("==========================================");

  // Force navigation
  window.location.href = targetUrl;
}

// Toast function
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

// Activity logging
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

console.log("USER-DETAILS.JS FULLY LOADED AND READY");

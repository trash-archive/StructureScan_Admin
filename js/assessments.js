// ===== ASSESSMENTS.JS - IMPROVED VERSION =====
// Assessment Management with Pagination, Total Issues, and Fixed Date Display

// ===== GLOBAL VARIABLES =====
let allAssessments = []; // Store all assessments for pagination
let currentPage = 1; // Current page number
const itemsPerPage = 10; // Items per page (as requested)

// ===== AUTHENTICATION CHECK =====
// Check if user is logged in and has admin privileges
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) {
    // No user logged in, redirect to login
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
        // User is not admin, deny access
        alert("Access denied. Admin only.");
        firebase.auth().signOut();
        window.location.href = "index.html";
        return;
      }

      // ✅ User is admin, load assessments
      loadAssessments();
    })
    .catch((error) => {
      console.error("Error checking admin status:", error);
    });
});

// ===== LOAD ALL ASSESSMENTS =====
// Load all assessments from all users' subcollections
function loadAssessments() {
  const db = firebase.firestore();
  const tableBody = document.getElementById("assessmentsTableBody");

  // Show loading state
  tableBody.innerHTML =
    '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2 text-muted">Loading assessments...</p></td></tr>';

  allAssessments = []; // Reset assessments array

  // Get all users first
  db.collection("users")
    .get()
    .then((usersSnapshot) => {
      const promises = [];

      // For each user, get their assessments subcollection
      usersSnapshot.forEach((userDoc) => {
        const promise = db
          .collection("users")
          .doc(userDoc.id)
          .collection("assessments")
          .get()
          .then((assessmentsSnapshot) => {
            assessmentsSnapshot.forEach((assessmentDoc) => {
              // Store each assessment with user data
              allAssessments.push({
                id: assessmentDoc.id,
                userId: userDoc.id,
                userData: userDoc.data(),
                ...assessmentDoc.data(),
              });
            });
          });
        promises.push(promise);
      });

      return Promise.all(promises);
    })
    .then(() => {
      // ✅ Sort assessments by date (newest first)
      allAssessments.sort((a, b) => {
        const dateA = getAssessmentDate(a);
        const dateB = getAssessmentDate(b);
        return dateB - dateA; // Descending order
      });

      // ✅ Update total assessments count card
      document.getElementById("totalAssessmentsCount").textContent =
        allAssessments.length;

      // Reset to page 1 and display
      currentPage = 1;
      displayAssessments();
    })
    .catch((error) => {
      console.error("Error loading assessments:", error);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>Error loading assessments</td></tr>';
    });
}

// ===== DISPLAY ASSESSMENTS WITH PAGINATION =====
// Display assessments for the current page
function displayAssessments() {
  const tableBody = document.getElementById("assessmentsTableBody");

  // Check if there are assessments
  if (allAssessments.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center py-4"><i class="bi bi-inbox me-2"></i>No assessments found</td></tr>';
    updatePaginationInfo(0, 0, 0);
    return;
  }

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, allAssessments.length);
  const pageAssessments = allAssessments.slice(startIndex, endIndex);

  // Clear table
  tableBody.innerHTML = "";

  // Display each assessment in current page
  pageAssessments.forEach((assessment) => {
    const userName =
      assessment.userData.fullName ||
      assessment.userData.email ||
      assessment.userId;

    // ✅ Format date properly (actual report generated date)
    const formattedDate = formatAssessmentDate(assessment);

    // ✅ Calculate total issues
    const totalIssues = assessment.totalIssues || 0;

    // Create table row
    const row = `
      <tr>
        <td><small class="text-break">${assessment.id}</small></td>
        <td>${userName}</td>
        <td>${formattedDate}</td>
        <td><span class="badge bg-primary">${totalIssues} issue${
      totalIssues !== 1 ? "s" : ""
    }</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewAssessment('${
            assessment.userId
          }', '${assessment.id}')">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });

  // ✅ Update pagination controls
  updatePaginationInfo(startIndex + 1, endIndex, allAssessments.length);
  updatePaginationButtons();
}

// ===== FORMAT ASSESSMENT DATE =====
// Format assessment date from Firestore timestamp to readable format
function formatAssessmentDate(assessment) {
  let date = null;

  // Try different timestamp formats
  if (assessment.timestamp) {
    if (
      typeof assessment.timestamp === "number" &&
      assessment.timestamp > 1e10
    ) {
      // Unix timestamp in milliseconds
      date = new Date(assessment.timestamp);
    } else if (typeof assessment.timestamp === "number") {
      // Unix timestamp in seconds
      date = new Date(assessment.timestamp * 1000);
    } else if (assessment.timestamp.toDate) {
      // Firestore Timestamp
      date = assessment.timestamp.toDate();
    }
  } else if (assessment.date) {
    date = new Date(assessment.date);
  }

  // Format date
  if (date && date instanceof Date && !isNaN(date)) {
    return formatDate(date);
  }

  return "N/A";
}

// ===== GET ASSESSMENT DATE FOR SORTING =====
// Get Date object from assessment for sorting purposes
function getAssessmentDate(assessment) {
  if (assessment.timestamp) {
    if (
      typeof assessment.timestamp === "number" &&
      assessment.timestamp > 1e10
    ) {
      return new Date(assessment.timestamp);
    } else if (typeof assessment.timestamp === "number") {
      return new Date(assessment.timestamp * 1000);
    } else if (assessment.timestamp.toDate) {
      return assessment.timestamp.toDate();
    }
  } else if (assessment.date) {
    return new Date(assessment.date);
  }
  return new Date(0); // Default to epoch if no date
}

// ===== DATE FORMATTING HELPER =====
// Format date to "Jan 1, 2025 at 2:30 PM" format
function formatDate(date) {
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
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}`;
}

// ===== UPDATE PAGINATION INFO =====
// Update the "Showing X-Y of Z assessments" text
function updatePaginationInfo(start, end, total) {
  const paginationInfo = document.getElementById("paginationInfo");
  paginationInfo.textContent = `Showing ${start}-${end} of ${total} assessments`;
}

// ===== UPDATE PAGINATION BUTTONS =====
// Enable/disable Previous and Next buttons based on current page
function updatePaginationButtons() {
  const totalPages = Math.ceil(allAssessments.length / itemsPerPage);
  const prevPageItem = document.getElementById("prevPageItem");
  const nextPageItem = document.getElementById("nextPageItem");

  // Disable Previous button on first page
  if (currentPage === 1) {
    prevPageItem.classList.add("disabled");
  } else {
    prevPageItem.classList.remove("disabled");
  }

  // Disable Next button on last page
  if (currentPage >= totalPages) {
    nextPageItem.classList.add("disabled");
  } else {
    nextPageItem.classList.remove("disabled");
  }
}

// ===== PAGINATION BUTTON HANDLERS =====
// Previous page button click handler
document.getElementById("prevPage").addEventListener("click", function (e) {
  e.preventDefault();
  if (currentPage > 1) {
    currentPage--;
    displayAssessments();
    // Scroll to top of table
    document
      .querySelector(".table-responsive")
      .scrollIntoView({ behavior: "smooth" });
  }
});

// Next page button click handler
document.getElementById("nextPage").addEventListener("click", function (e) {
  e.preventDefault();
  const totalPages = Math.ceil(allAssessments.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    displayAssessments();
    // Scroll to top of table
    document
      .querySelector(".table-responsive")
      .scrollIntoView({ behavior: "smooth" });
  }
});

// ===== VIEW ASSESSMENT DETAILS =====
// Navigate to assessment details page with proper context
function viewAssessment(userId, assessmentId) {
  console.log(
    "Viewing assessment from assessments.html:",
    userId,
    assessmentId
  );

  // ✅ Store context for back navigation
  sessionStorage.setItem("returnPage", "assessments");
  sessionStorage.removeItem("returnUserId"); // Not needed for assessments page

  // ✅ Log activity
  logActivity("assessment_viewed", `Viewed assessment: ${assessmentId}`);

  // Navigate to assessment-details page
  window.location.href = `assessment-details.html?userId=${encodeURIComponent(
    userId
  )}&assessmentId=${encodeURIComponent(assessmentId)}`;
}

// ===== SEARCH FUNCTIONALITY =====
// Filter assessments based on search input
document
  .getElementById("searchAssessment")
  .addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm === "") {
      // If search is empty, show all assessments with pagination
      displayAssessments();
      return;
    }

    // Filter assessments based on search term
    const filteredAssessments = allAssessments.filter((assessment) => {
      const userName = (
        assessment.userData.fullName ||
        assessment.userData.email ||
        assessment.userId
      ).toLowerCase();
      const assessmentId = assessment.id.toLowerCase();

      return userName.includes(searchTerm) || assessmentId.includes(searchTerm);
    });

    // Display filtered results (temporarily override allAssessments)
    const originalAssessments = [...allAssessments];
    allAssessments = filteredAssessments;
    currentPage = 1;
    displayAssessments();
    allAssessments = originalAssessments; // Restore original
  });

// ===== LOG ACTIVITY =====
// Log admin actions to Firestore
function logActivity(action, description) {
  const db = firebase.firestore();
  const user = firebase.auth().currentUser;

  db.collection("activityLog")
    .add({
      action: action,
      description: description,
      adminEmail: user ? user.email : "Unknown",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch((error) => {
      console.error("Error logging activity:", error);
    });
}

// ===== LOGOUT HANDLER =====
// Handle admin logout
document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "index.html";
    });
});

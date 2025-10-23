// ASSESSMENTS.JS - Fixed to not interfere with navigation

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

      // User is admin, load assessments
      loadAssessments();
    });
});

// Load all assessments from nested subcollections
function loadAssessments() {
  const db = firebase.firestore();
  const tableBody = document.getElementById("assessmentsTableBody");
  tableBody.innerHTML =
    '<tr><td colspan="5" class="text-center">Loading assessments...</td></tr>';

  let allAssessments = [];

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
      if (allAssessments.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">No assessments found</td></tr>';
        return;
      }

      tableBody.innerHTML = "";
      allAssessments.forEach((assessment) => {
        const userName =
          assessment.userData.fullName ||
          assessment.userData.email ||
          assessment.userId;

        const row = `
          <tr>
            <td><small>${assessment.id}</small></td>
            <td>${userName}</td>
            <td>${assessment.timestamp || assessment.date || "N/A"}</td>
            <td><span class="badge bg-success">${
              assessment.status || "Completed"
            }</span></td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewAssessment('${
                assessment.userId
              }', '${assessment.id}')">
                <i class="bi bi-eye"></i> View
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteAssessment('${
                assessment.userId
              }', '${assessment.id}', '${userName.replace(/'/g, "\\'")}')">
                <i class="bi bi-trash"></i> Delete
              </button>
            </td>
          </tr>
        `;
        tableBody.innerHTML += row;
      });
    })
    .catch((error) => {
      console.error("Error loading assessments:", error);
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center text-danger">Error loading assessments</td></tr>';
    });
}

// View assessment details - Store context for proper back navigation
function viewAssessment(userId, assessmentId) {
  console.log(
    "Viewing assessment from assessments.html:",
    userId,
    assessmentId
  );

  // Store context so assessment-details knows it came from assessments page
  sessionStorage.setItem("returnPage", "assessments");
  sessionStorage.removeItem("returnUserId"); // Not needed for assessments page

  // Navigate to assessment-details
  window.location.href = `assessment-details.html?userId=${encodeURIComponent(
    userId
  )}&assessmentId=${encodeURIComponent(assessmentId)}`;
}

// Delete assessment
function deleteAssessment(userId, assessmentId, userName) {
  if (confirm("Are you sure you want to delete this assessment?")) {
    const db = firebase.firestore();
    db.collection("users")
      .doc(userId)
      .collection("assessments")
      .doc(assessmentId)
      .delete()
      .then(() => {
        alert("Assessment deleted successfully!");
        logActivity(
          "assessment_deleted",
          `Deleted assessment: ${assessmentId} (User: ${userName})`
        );
        loadAssessments();
      })
      .catch((error) => {
        alert("Error deleting assessment: " + error.message);
      });
  }
}

// Search functionality
document
  .getElementById("searchAssessment")
  .addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll("#assessmentsTableBody tr");

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });

// Log activity to Firestore
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

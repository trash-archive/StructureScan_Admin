// Get URL parameters FIRST before any Firebase auth
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userId");
const assessmentId = urlParams.get("assessmentId");

console.log(
  "Assessment Details - userId:",
  userId,
  "assessmentId:",
  assessmentId
);

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
      // Check parameters and load assessment
      if (userId && assessmentId) {
        console.log(
          "Loading assessment details for user:",
          userId,
          "assessment:",
          assessmentId
        );
        loadAssessmentDetails(userId, assessmentId);
      } else {
        alert("Invalid assessment parameters");
        // Check where to go back
        const returnPage = sessionStorage.getItem("returnPage");
        const returnUserId = sessionStorage.getItem("returnUserId");

        if (returnPage === "user-detail" && returnUserId) {
          window.location.href = `user-detail.html?userId=${encodeURIComponent(
            returnUserId
          )}`;
        } else {
          window.location.href = "assessments.html";
        }
      }
    });
});

async function loadAssessmentDetails(userId, assessmentId) {
  const db = firebase.firestore();
  try {
    console.log("Fetching user document:", userId);
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.error("User not found:", userId);
      alert("User not found");
      goBack();
      return;
    }

    const userData = userDoc.data();
    console.log("User data loaded:", userData);

    console.log("Fetching assessment document:", assessmentId);
    const assessmentDoc = await db
      .collection("users")
      .doc(userId)
      .collection("assessments")
      .doc(assessmentId)
      .get();

    if (!assessmentDoc.exists) {
      console.error("Assessment not found:", assessmentId);
      alert("Assessment not found");
      goBack();
      return;
    }

    const data = assessmentDoc.data();
    console.log("Full assessment data:", data);

    // Assessment ID
    document.getElementById(
      "assessmentId"
    ).textContent = `Assessment ID: ${assessmentId}`;

    // User info
    document.getElementById("userName").textContent =
      userData && userData.fullName ? userData.fullName : "N/A";
    document.getElementById("userEmail").textContent =
      userData && userData.email ? userData.email : "N/A";
    document.getElementById("dateCreated").textContent =
      userData && userData.createdAt
        ? formatDate(userData.createdAt.toDate())
        : "N/A";

    // Assessment overview
    document.getElementById("assessmentName").textContent =
      data.assessmentName || data.buildingType || "N/A";

    // Handle date or timestamp
    let subDate = null;
    if (data.timestamp) {
      if (typeof data.timestamp === "number" && data.timestamp > 1e10) {
        subDate = new Date(data.timestamp);
      } else if (typeof data.timestamp === "number") {
        subDate = new Date(data.timestamp * 1000);
      } else if (data.timestamp.toDate) {
        subDate = data.timestamp.toDate();
      }
    } else if (data.date) {
      subDate = data.date;
    }
    document.getElementById("submissionDate").textContent = subDate
      ? subDate instanceof Date
        ? formatDateTime(subDate)
        : subDate
      : "N/A";
    document.getElementById("reportGenerated").textContent = subDate
      ? subDate instanceof Date
        ? formatDateTime(subDate)
        : subDate
      : "N/A";

    // Building Information - CHECK BOTH ROOT AND NESTED LOCATIONS

    // Overall Risk - most important, show prominently
    const overallRisk = data.overallRisk || "N/A";
    const riskElement = document.getElementById("overallRisk");
    if (riskElement) {
      riskElement.textContent = overallRisk;
      // Add color coding based on risk level
      riskElement.className = "badge fs-5 ";
      if (overallRisk.toLowerCase().includes("high")) {
        riskElement.classList.add("bg-danger");
      } else if (
        overallRisk.toLowerCase().includes("moderate") ||
        overallRisk.toLowerCase().includes("medium")
      ) {
        riskElement.classList.add("bg-warning", "text-dark");
      } else if (overallRisk.toLowerCase().includes("low")) {
        riskElement.classList.add("bg-success");
      } else {
        riskElement.classList.add("bg-secondary");
      }
    }

    document.getElementById("structureType").textContent =
      data.buildingType || "N/A";

    // Number of Floors - check root first, then environmentalRisks
    document.getElementById("floors").textContent =
      data.floors ||
      (data.environmentalRisks && data.environmentalRisks.floors) ||
      "N/A";

    // Construction Material - check root first, then environmentalRisks
    document.getElementById("material").textContent =
      data.material ||
      (data.environmentalRisks && data.environmentalRisks.material) ||
      "N/A";

    // Foundation Type - check root first, then environmentalRisks
    document.getElementById("foundationType").textContent =
      data.foundation ||
      (data.environmentalRisks && data.environmentalRisks.foundation) ||
      "N/A";

    // Environment - directly from root
    document.getElementById("environment").textContent =
      data.environment || "N/A";

    // Year Built - from constructionYear
    document.getElementById("yearBuilt").textContent =
      data.constructionYear || "N/A";

    // Last Renovation - from renovationYear
    document.getElementById("lastRenovation").textContent =
      data.renovationYear || "N/A";

    // Occupancy Level - check root first, then environmentalRisks
    document.getElementById("occupancyLevel").textContent =
      data.occupancy ||
      (data.environmentalRisks && data.environmentalRisks.occupancy) ||
      "N/A";

    // Additional Notes - check root first, then environmentalRisks
    document.getElementById("additionalNotes").textContent =
      data.notes ||
      (data.environmentalRisks && data.environmentalRisks.notes) ||
      "N/A";

    // Previous Issues - from root array
    document.getElementById("previousIssues").textContent =
      Array.isArray(data.previousIssues) && data.previousIssues.length > 0
        ? data.previousIssues.join(", ")
        : "N/A";

    // Load submitted images
    await loadSubmittedImages(data, subDate);

    console.log("Assessment details loaded successfully");
    logActivity(
      "assessment_viewed",
      `Viewed assessment: ${assessmentId} for user: ${userId}`
    );
  } catch (error) {
    console.error("Error loading assessment:", error);
    alert("Error loading assessment details: " + error.message);
    goBack();
  }
}

// Load submitted images from assessments array
async function loadSubmittedImages(data, assessmentDate) {
  const imagesLoading = document.getElementById("imagesLoading");
  const imagesContainer = document.getElementById("imagesContainer");
  const imagesGrid = document.getElementById("imagesGrid");
  const noImagesMessage = document.getElementById("noImagesMessage");
  const analysisDateElement = document.getElementById("analysisDate");

  try {
    // Check if assessments array exists
    if (
      !data.assessments ||
      !Array.isArray(data.assessments) ||
      data.assessments.length === 0
    ) {
      imagesLoading.classList.add("d-none");
      noImagesMessage.classList.remove("d-none");
      return;
    }

    // Clear grid
    imagesGrid.innerHTML = "";

    // Loop through assessments and create image cards
    data.assessments.forEach((assessment, index) => {
      // Determine status text and class
      let statusText = "No issues detected";
      let statusClass = "status-no-issues";

      if (assessment.damageType) {
        const damageType = assessment.damageType.toLowerCase();
        if (damageType.includes("crack")) {
          statusText = assessment.confidenceLevel || "Crack detected";
          statusClass = "status-crack";
        } else if (damageType.includes("paint")) {
          statusText = assessment.confidenceLevel || "Paint damage";
          statusClass = "status-paint";
        } else if (
          damageType.includes("algae") ||
          damageType.includes("moss")
        ) {
          statusText = assessment.confidenceLevel || "Algae/Moss detected";
          statusClass = "status-algae";
        }
      }

      // Extract filename from imageUri
      const imageUri = assessment.imageUri || "";
      const filename = imageUri
        ? decodeURIComponent(imageUri.split("/").pop().split("?")[0])
        : `IMG_${String(index + 1).padStart(3, "0")}.jpg`;

      // Create column
      const colDiv = document.createElement("div");
      colDiv.className = "col-6 col-sm-4 col-md-3 col-lg-2";

      // Create image card
      colDiv.innerHTML = `
        <div class="image-card-item" onclick="openImageModal(${index}, '${imageUri}', '${filename}', '${statusText}', '${
        assessment.damageType || "N/A"
      }')">
          <div class="image-placeholder-box">
            ${
              imageUri
                ? `<img src="${imageUri}" alt="Image ${
                    index + 1
                  }" onerror="this.onerror=null; this.src='https://via.placeholder.com/120x120?text=Image+${
                    index + 1
                  }';">`
                : `<span>Image ${index + 1}</span>`
            }
          </div>
          <div class="image-title-text">IMAGE ${index + 1}</div>
          <div class="image-filename-text">${filename}</div>
          <div class="image-status-badge ${statusClass}">${statusText}</div>
        </div>
      `;

      imagesGrid.appendChild(colDiv);
    });

    // Show images container and hide loading
    imagesLoading.classList.add("d-none");
    imagesContainer.classList.remove("d-none");

    // Update analysis date
    if (assessmentDate) {
      analysisDateElement.textContent = formatDateTime(assessmentDate);
    } else {
      analysisDateElement.textContent = "N/A";
    }
  } catch (error) {
    console.error("Error loading images:", error);
    imagesLoading.classList.add("d-none");
    noImagesMessage.classList.remove("d-none");
    noImagesMessage.innerHTML = `
      <i class="bi bi-exclamation-triangle me-2"></i>
      Error loading images: ${error.message}
    `;
  }
}

// Open image in modal
function openImageModal(index, imageUrl, filename, status, damageType) {
  const modal = new bootstrap.Modal(document.getElementById("imageModal"));
  const modalImage = document.getElementById("modalPreviewImage");
  const modalTitle = document.getElementById("imageModalTitle");
  const modalDetails = document.getElementById("modalImageDetails");

  modalTitle.textContent = `Image ${index + 1} Details`;

  // Set image with better error handling
  modalImage.onerror = function () {
    this.src = "https://via.placeholder.com/800x600?text=Image+Loading+Failed";
  };
  modalImage.src =
    imageUrl || "https://via.placeholder.com/800x600?text=No+Image";

  modalDetails.innerHTML = `
    <p class="mb-3"><strong>Filename:</strong><br><small class="text-muted">${filename}</small></p>
    <hr>
    <p class="mb-3"><strong>Damage Type:</strong><br>${damageType}</p>
    <p class="mb-3"><strong>Status:</strong><br><span class="badge bg-secondary">${status}</span></p>
    <p class="mb-0"><strong>Image Number:</strong><br>${index + 1}</p>
    <hr>
    <a href="${imageUrl}" target="_blank" class="btn btn-sm btn-primary w-100 mt-2">
      <i class="bi bi-box-arrow-up-right me-1"></i> Open in New Tab
    </a>
  `;

  modal.show();
}

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

function formatDateTime(date) {
  if (!date || !(date instanceof Date)) return "N/A";
  const dateStr = formatDate(date);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${dateStr} at ${displayHours}:${minutes} ${ampm}`;
}

// SMART BACK NAVIGATION - Returns to the correct page based on context
function goBack() {
  // Check if we came from user-details page
  const returnPage = sessionStorage.getItem("returnPage");
  const returnUserId = sessionStorage.getItem("returnUserId");

  if (returnPage === "user-detail" && returnUserId) {
    // Clear session storage
    sessionStorage.removeItem("returnPage");
    sessionStorage.removeItem("returnUserId");
    // Go back to user-details.html (with 's')
    window.location.href = `user-details.html?userId=${returnUserId}`;
  } else {
    // Otherwise go to assessments list
    window.location.href = "assessments.html";
  }
}

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

document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "index.html";
    });
});

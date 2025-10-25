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
        const returnPage = sessionStorage.getItem("returnPage");
        const returnUserId = sessionStorage.getItem("returnUserId");

        if (returnPage === "user-detail" && returnUserId) {
          window.location.href = `user-details.html?userId=${encodeURIComponent(
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

    document.getElementById(
      "assessmentId"
    ).textContent = `Assessment ID: ${assessmentId}`;

    document.getElementById("userName").textContent =
      userData && userData.fullName ? userData.fullName : "N/A";
    document.getElementById("userEmail").textContent =
      userData && userData.email ? userData.email : "N/A";
    document.getElementById("dateCreated").textContent =
      userData && userData.createdAt
        ? formatDate(userData.createdAt.toDate())
        : "N/A";

    document.getElementById("assessmentName").textContent =
      data.assessmentName || data.buildingType || "N/A";

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

    const overallRisk = data.overallRisk || "N/A";
    const riskElement = document.getElementById("overallRisk");
    if (riskElement) {
      riskElement.textContent = overallRisk;
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

    document.getElementById("floors").textContent =
      data.floors ||
      (data.environmentalRisks && data.environmentalRisks.floors) ||
      "N/A";

    document.getElementById("material").textContent =
      data.material ||
      (data.environmentalRisks && data.environmentalRisks.material) ||
      "N/A";

    document.getElementById("foundationType").textContent =
      data.foundation ||
      (data.environmentalRisks && data.environmentalRisks.foundation) ||
      "N/A";

    document.getElementById("environment").textContent =
      data.environment || "N/A";

    document.getElementById("yearBuilt").textContent =
      data.constructionYear || "N/A";

    document.getElementById("lastRenovation").textContent =
      data.renovationYear || "N/A";

    document.getElementById("occupancyLevel").textContent =
      data.occupancy ||
      (data.environmentalRisks && data.environmentalRisks.occupancy) ||
      "N/A";

    document.getElementById("additionalNotes").textContent =
      data.notes ||
      (data.environmentalRisks && data.environmentalRisks.notes) ||
      "N/A";

    document.getElementById("previousIssues").textContent =
      Array.isArray(data.previousIssues) && data.previousIssues.length > 0
        ? data.previousIssues.join(", ")
        : "N/A";

    loadRecommendations(data);
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

// ✅ FINAL: Display recommendations with inline labels
function loadRecommendations(data) {
  const recommendationsLoading = document.getElementById(
    "recommendationsLoading"
  );
  const recommendationsContainer = document.getElementById(
    "recommendationsContainer"
  );
  const recommendationsList = document.getElementById("recommendationsList");
  const noRecommendationsMessage = document.getElementById(
    "noRecommendationsMessage"
  );

  try {
    console.log("🔍 Loading recommendations from assessments array");

    if (
      !data.assessments ||
      !Array.isArray(data.assessments) ||
      data.assessments.length === 0
    ) {
      console.log("❌ No assessments found");
      recommendationsLoading.classList.add("d-none");
      noRecommendationsMessage.classList.remove("d-none");
      return;
    }

    console.log("✅ Found", data.assessments.length, "assessment(s)");

    recommendationsList.innerHTML = "";

    let totalActions = 0;

    // Loop through each assessment (each image)
    data.assessments.forEach((assessment, assessmentIndex) => {
      console.log(`📋 Processing assessment ${assessmentIndex}:`, assessment);

      const recommendations = assessment.recommendations;

      if (
        !recommendations ||
        !Array.isArray(recommendations) ||
        recommendations.length === 0
      ) {
        console.log(`⚠️ Assessment ${assessmentIndex} has no recommendations`);
        return;
      }

      console.log(
        `✅ Found ${recommendations.length} recommendation(s) in assessment ${assessmentIndex}`
      );

      // Loop through recommendations in this assessment
      recommendations.forEach((recommendation, recIndex) => {
        console.log(
          `  📋 Processing recommendation ${recIndex}:`,
          recommendation
        );

        // Get actions map - handle nested structure
        let actionsMap = null;

        if (recommendation["0"]) {
          actionsMap = recommendation["0"];
        } else {
          actionsMap = recommendation;
        }

        console.log(`    🔍 Extracted actions map:`, actionsMap);

        if (!actionsMap || !actionsMap.actions) {
          console.log(`    ⚠️ No actions found in this recommendation`);
          return;
        }

        // Extract properties - actions can be string or array
        const actionsValue = actionsMap.actions;
        const title = actionsMap.title || "Untitled";
        const description = actionsMap.description || "No description";
        const severity = actionsMap.severity || "LOW";

        console.log(`      📌 Action:`, {
          actions: actionsValue,
          title,
          description,
          severity,
        });

        // Determine severity class
        let severityClass = "severity-low";
        const severityLower = String(severity).toLowerCase();

        if (severityLower === "high") {
          severityClass = "severity-high";
        } else if (severityLower === "moderate" || severityLower === "medium") {
          severityClass = "severity-moderate";
        }

        // Create inline-style recommendation card
        const cardDiv = document.createElement("div");
        cardDiv.className = `card recommendation-card ${severityClass} mb-3`;
        cardDiv.innerHTML = `
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="flex-grow-1">
                <p class="mb-2"><strong>Actions:</strong> ${
                  Array.isArray(actionsValue)
                    ? actionsValue.join(", ")
                    : actionsValue
                }</p>
                <p class="mb-2"><strong>Description:</strong> ${description}</p>
                <p class="mb-0"><strong>Title:</strong> ${title}</p>
              </div>
              <div class="text-end ms-3">
                <strong>Severity:</strong><br>
                <span class="severity-badge ${severityClass} mt-1">${severity.toUpperCase()}</span>
              </div>
            </div>
          </div>
        `;

        recommendationsList.appendChild(cardDiv);
        totalActions++;
      });
    });

    console.log(`✅ Total actions displayed: ${totalActions}`);

    if (totalActions === 0) {
      console.log("⚠️ No actions were found in any recommendations");
      recommendationsLoading.classList.add("d-none");
      noRecommendationsMessage.classList.remove("d-none");
      return;
    }

    recommendationsLoading.classList.add("d-none");
    recommendationsContainer.classList.remove("d-none");

    console.log("✅ Recommendations loaded successfully");
  } catch (error) {
    console.error("❌ Error loading recommendations:", error);
    recommendationsLoading.classList.add("d-none");
    noRecommendationsMessage.classList.remove("d-none");
    noRecommendationsMessage.innerHTML = `
      <i class="bi bi-exclamation-triangle me-2"></i>
      Error loading recommendations: ${error.message}
    `;
  }
}

async function loadSubmittedImages(data, assessmentDate) {
  const imagesLoading = document.getElementById("imagesLoading");
  const imagesContainer = document.getElementById("imagesContainer");
  const imagesGrid = document.getElementById("imagesGrid");
  const noImagesMessage = document.getElementById("noImagesMessage");
  const analysisDateElement = document.getElementById("analysisDate");

  try {
    if (
      !data.assessments ||
      !Array.isArray(data.assessments) ||
      data.assessments.length === 0
    ) {
      imagesLoading.classList.add("d-none");
      noImagesMessage.classList.remove("d-none");
      return;
    }

    imagesGrid.innerHTML = "";

    data.assessments.forEach((assessment, index) => {
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

      const imageUri = assessment.imageUri || "";
      const filename = imageUri
        ? decodeURIComponent(imageUri.split("/").pop().split("?")[0])
        : `IMG_${String(index + 1).padStart(3, "0")}.jpg`;

      const colDiv = document.createElement("div");
      colDiv.className = "col-6 col-sm-4 col-md-3 col-lg-2";

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

    imagesLoading.classList.add("d-none");
    imagesContainer.classList.remove("d-none");

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

function openImageModal(index, imageUrl, filename, status, damageType) {
  const modal = new bootstrap.Modal(document.getElementById("imageModal"));
  const modalImage = document.getElementById("modalPreviewImage");
  const modalTitle = document.getElementById("imageModalTitle");
  const modalDetails = document.getElementById("modalImageDetails");

  modalTitle.textContent = `Image ${index + 1} Details`;

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

function goBack() {
  const returnPage = sessionStorage.getItem("returnPage");
  const returnUserId = sessionStorage.getItem("returnUserId");

  if (returnPage === "user-detail" && returnUserId) {
    sessionStorage.removeItem("returnPage");
    sessionStorage.removeItem("returnUserId");
    window.location.href = `user-details.html?userId=${returnUserId}`;
  } else {
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

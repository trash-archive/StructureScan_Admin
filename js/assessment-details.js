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

    // User Information - REMOVED dateCreated
    document.getElementById("userName").textContent =
      userData && userData.fullName ? userData.fullName : "N/A";
    document.getElementById("userEmail").textContent =
      userData && userData.email ? userData.email : "N/A";

    // Assessment Overview - REMOVED submissionDate
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

    // Only set reportGenerated (removed submissionDate)
    document.getElementById("reportGenerated").textContent = subDate
      ? subDate instanceof Date
        ? formatDateTime(subDate)
        : subDate
      : "N/A";

    // ✅ NEW: Load Detection Summary Data
    loadDetectionSummary(data);

    // Overall Risk Assessment
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

// ✅ IMPROVED: Load Detection Summary with Animated Bars
function loadDetectionSummary(data) {
  console.log("🔍 Loading detection summary data");

  // Total Issues Detected
  const totalIssues = data.totalIssues || 0;
  document.getElementById("totalIssuesDetected").textContent = totalIssues;

  // Issue Breakdown by Type
  const crackTotal =
    (data.crackHighCount || 0) +
    (data.crackModerateCount || 0) +
    (data.crackLowCount || 0);
  const paintTotal =
    (data.paintHighCount || 0) +
    (data.paintModerateCount || 0) +
    (data.paintLowCount || 0);
  const algaeTotal =
    (data.algaeHighCount || 0) +
    (data.algaeModerateCount || 0) +
    (data.algaeLowCount || 0);

  document.getElementById("crackCount").textContent = crackTotal;
  document.getElementById("paintCount").textContent = paintTotal;
  document.getElementById("algaeCount").textContent = algaeTotal;

  // Severity Distribution
  const highSeverity =
    (data.crackHighCount || 0) +
    (data.paintHighCount || 0) +
    (data.algaeHighCount || 0);
  const moderateSeverity =
    (data.crackModerateCount || 0) +
    (data.paintModerateCount || 0) +
    (data.algaeModerateCount || 0);
  const lowSeverity =
    (data.crackLowCount || 0) +
    (data.paintLowCount || 0) +
    (data.algaeLowCount || 0);

  document.getElementById("highSeverityCount").textContent = highSeverity;
  document.getElementById("moderateSeverityCount").textContent =
    moderateSeverity;
  document.getElementById("lowSeverityCount").textContent = lowSeverity;

  // ✅ IMPROVED: Animate severity bars with percentages displayed inside
  const totalSeverity = highSeverity + moderateSeverity + lowSeverity;

  if (totalSeverity > 0) {
    const highPercentage = Math.round((highSeverity / totalSeverity) * 100);
    const moderatePercentage = Math.round(
      (moderateSeverity / totalSeverity) * 100
    );
    const lowPercentage = Math.round((lowSeverity / totalSeverity) * 100);

    // Animate bars with delay and update percentage text
    setTimeout(() => {
      document.getElementById("highSeverityBar").style.width =
        highPercentage + "%";
      document.getElementById("highSeverityPercent").textContent =
        highPercentage + "%";
    }, 100);

    setTimeout(() => {
      document.getElementById("moderateSeverityBar").style.width =
        moderatePercentage + "%";
      document.getElementById("moderateSeverityPercent").textContent =
        moderatePercentage + "%";
    }, 200);

    setTimeout(() => {
      document.getElementById("lowSeverityBar").style.width =
        lowPercentage + "%";
      document.getElementById("lowSeverityPercent").textContent =
        lowPercentage + "%";
    }, 300);
  } else {
    // If no severity issues, set all bars to 0%
    document.getElementById("highSeverityBar").style.width = "0%";
    document.getElementById("highSeverityPercent").textContent = "0%";

    document.getElementById("moderateSeverityBar").style.width = "0%";
    document.getElementById("moderateSeverityPercent").textContent = "0%";

    document.getElementById("lowSeverityBar").style.width = "0%";
    document.getElementById("lowSeverityPercent").textContent = "0%";
  }

  console.log("✅ Detection summary loaded:", {
    totalIssues,
    byType: { cracks: crackTotal, paint: paintTotal, algae: algaeTotal },
    bySeverity: {
      high: highSeverity,
      moderate: moderateSeverity,
      low: lowSeverity,
    },
  });
}

// ✅ IMPROVED: Display recommendations with deduplication/merging
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

    // ✅ NEW: Use a Map to group duplicate recommendations
    const recommendationsMap = new Map();

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

        // ✅ NEW: Create unique key based on title + severity to group duplicates
        const uniqueKey = `${title
          .toLowerCase()
          .trim()}_${severity.toLowerCase()}`;

        if (recommendationsMap.has(uniqueKey)) {
          // If this recommendation already exists, increment the count
          const existing = recommendationsMap.get(uniqueKey);
          existing.count++;
          console.log(
            `    🔄 Merged duplicate recommendation: ${title} (count: ${existing.count})`
          );
        } else {
          // New unique recommendation, add to map
          recommendationsMap.set(uniqueKey, {
            actions: actionsValue,
            title: title,
            description: description,
            severity: severity,
            count: 1,
          });
          console.log(`    ✅ Added new recommendation: ${title}`);
        }
      });
    });

    console.log(`✅ Total unique recommendations: ${recommendationsMap.size}`);

    // Now display the merged recommendations
    let totalActions = 0;
    recommendationsMap.forEach((rec) => {
      const { actions, title, description, severity, count } = rec;

      // Determine severity class
      let severityClass = "severity-low";
      const severityLower = String(severity).toLowerCase();

      if (severityLower === "high") {
        severityClass = "severity-high";
      } else if (severityLower === "moderate" || severityLower === "medium") {
        severityClass = "severity-moderate";
      }

      // ✅ NEW: Show count if more than 1 instance detected
      const countBadge =
        count > 1
          ? `<span class="badge bg-secondary ms-2">${count}x detected</span>`
          : "";

      // Create inline-style recommendation card
      const cardDiv = document.createElement("div");
      cardDiv.className = `card recommendation-card ${severityClass} mb-3`;
      cardDiv.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="flex-grow-1">
              <p class="mb-2"><strong>Actions:</strong> ${
                Array.isArray(actions) ? actions.join(", ") : actions
              }</p>
              <p class="mb-2"><strong>Description:</strong> ${description}</p>
              <p class="mb-0"><strong>Title:</strong> ${title} ${countBadge}</p>
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

    console.log(`✅ Total actions displayed: ${totalActions}`);

    if (totalActions === 0) {
      console.log("⚠️ No actions were found in any recommendations");
      recommendationsLoading.classList.add("d-none");
      noRecommendationsMessage.classList.remove("d-none");
      return;
    }

    recommendationsLoading.classList.add("d-none");
    recommendationsContainer.classList.remove("d-none");

    console.log("✅ Recommendations loaded successfully with deduplication");
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

// ✅ IMPROVED: Store assessment data globally for modal access
let assessmentsData = [];

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

    // ✅ NEW: Store assessments globally for modal access
    assessmentsData = data.assessments;

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

      // ✅ CHANGED: Pass index only, we'll get full data from global array
      colDiv.innerHTML = `
        <div class="image-card-item" onclick="openImageModal(${index})">
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

// ✅ COMPLETELY REDESIGNED: Modal with multiple issues support
function openImageModal(index) {
  console.log("🖼️ Opening modal for image", index + 1);

  // Get assessment data from global array
  const assessment = assessmentsData[index];

  if (!assessment) {
    console.error("Assessment data not found for index:", index);
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById("imageModal"));
  const modalImage = document.getElementById("modalPreviewImage");
  const modalImageNumber = document.getElementById("modalImageNumber");
  const modalImageFilename = document.getElementById("modalImageFilename");
  const modalImageRisk = document.getElementById("modalImageRisk");
  const modalImageLink = document.getElementById("modalImageLink");
  const modalIssuesContainer = document.getElementById("modalIssuesContainer");
  const modalNoIssues = document.getElementById("modalNoIssues");

  // Set image
  const imageUri = assessment.imageUri || "";
  modalImage.onerror = function () {
    this.src = "https://via.placeholder.com/800x600?text=Image+Loading+Failed";
  };
  modalImage.src =
    imageUri || "https://via.placeholder.com/800x600?text=No+Image";

  // Set image link
  modalImageLink.href = imageUri || "#";

  // Set image number
  modalImageNumber.textContent = index + 1;

  // Set filename
  const filename = imageUri
    ? decodeURIComponent(imageUri.split("/").pop().split("?")[0])
    : `IMG_${String(index + 1).padStart(3, "0")}.jpg`;
  modalImageFilename.textContent = filename;

  // Set risk level
  const imageRisk = assessment.imageRisk || assessment.damageLevel || "N/A";
  modalImageRisk.textContent = imageRisk;
  modalImageRisk.className = "badge";

  const riskLower = imageRisk.toLowerCase();
  if (riskLower.includes("high")) {
    modalImageRisk.classList.add("bg-danger");
  } else if (riskLower.includes("moderate") || riskLower.includes("medium")) {
    modalImageRisk.classList.add("bg-warning", "text-dark");
  } else if (riskLower.includes("low")) {
    modalImageRisk.classList.add("bg-success");
  } else {
    modalImageRisk.classList.add("bg-secondary");
  }

  // ✅ NEW: Display all detected issues from detectedIssues array
  const detectedIssues = assessment.detectedIssues || [];

  console.log("Detected issues for image", index + 1, ":", detectedIssues);

  if (detectedIssues.length === 0) {
    // No issues detected
    modalIssuesContainer.classList.add("d-none");
    modalNoIssues.classList.remove("d-none");
  } else {
    // Display all issues
    modalIssuesContainer.classList.remove("d-none");
    modalNoIssues.classList.add("d-none");
    modalIssuesContainer.innerHTML = "";

    detectedIssues.forEach((issue, issueIndex) => {
      const issueType = issue.type || "Unknown";
      const issueLevel = issue.level || "N/A";
      const issueConfidence = issue.confidence || 0;
      const confidencePercent = Math.round(issueConfidence * 100);

      // Determine badge color based on issue type
      let typeBadgeClass = "bg-secondary";
      const typeLower = issueType.toLowerCase();
      if (typeLower.includes("crack")) {
        typeBadgeClass = "bg-danger";
      } else if (typeLower.includes("paint")) {
        typeBadgeClass = "bg-warning text-dark";
      } else if (typeLower.includes("algae") || typeLower.includes("moss")) {
        typeBadgeClass = "bg-info";
      }

      // Determine severity badge
      let severityBadgeClass = "bg-secondary";
      const levelLower = issueLevel.toLowerCase();
      if (levelLower.includes("high")) {
        severityBadgeClass = "bg-danger";
      } else if (
        levelLower.includes("moderate") ||
        levelLower.includes("medium")
      ) {
        severityBadgeClass = "bg-warning text-dark";
      } else if (levelLower.includes("low")) {
        severityBadgeClass = "bg-success";
      }

      const issueCard = `
        <div class="border rounded p-3 mb-2 bg-light">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge ${typeBadgeClass} mb-1">${issueType}</span>
              <small class="d-block text-muted">Issue ${issueIndex + 1} of ${
        detectedIssues.length
      }</small>
            </div>
            <span class="badge ${severityBadgeClass}">${issueLevel} Severity</span>
          </div>
          <div class="mt-2">
            <small class="text-muted">Confidence Level:</small>
            <div class="progress" style="height: 20px;">
              <div class="progress-bar ${typeBadgeClass}" role="progressbar" style="width: ${confidencePercent}%;" aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100">
                ${confidencePercent}%
              </div>
            </div>
          </div>
        </div>
      `;

      modalIssuesContainer.innerHTML += issueCard;
    });
  }

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

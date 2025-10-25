const urlParams = new URLSearchParams(window.location.search);
const currentUserId = urlParams.get("userId");

let currentPhotoUrl = null;
let selectedFile = null;
let originalEmail = null; // Track original email

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

async function loadUserData(userId) {
  const db = firebase.firestore();

  try {
    console.log("🔍 Loading user data for ID:", userId);

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      alert("User not found");
      window.location.href = "users.html";
      return;
    }

    const userData = userDoc.data();
    console.log("📄 User data:", userData);

    // Get photo URL
    currentPhotoUrl = userData.photoUrl || null;
    console.log("📸 Photo URL:", currentPhotoUrl);

    // Store original email
    originalEmail = userData.email || "";

    // Populate form fields
    document.getElementById("fullName").value = userData.fullName || "";
    document.getElementById("email").value = userData.email || "";
    document.getElementById("role").value = userData.role || "User";
    document.getElementById("adminNotes").value = userData.adminNotes || "";

    // ✅ Display ONLY the photo
    displayUserPhoto();

    // Load statistics
    document.getElementById("userId").textContent = userId;

    const assessmentsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("assessments")
      .get();
    document.getElementById("totalAssessments").textContent =
      assessmentsSnapshot.size;

    const createdDate = userData.createdAt
      ? formatDate(userData.createdAt.toDate())
      : "N/A";
    document.getElementById("accountCreated").textContent = createdDate;

    console.log("✅ User data loaded successfully");
  } catch (error) {
    console.error("❌ Error loading user:", error);
    alert("Error loading user data");
    window.location.href = "users.html";
  }
}

// ✅ SIMPLE: Display photo only, no initials
function displayUserPhoto() {
  const avatarImg = document.getElementById("userAvatarImg");
  const removeBtn = document.getElementById("removePhotoBtn");

  if (!avatarImg) return;

  if (currentPhotoUrl && currentPhotoUrl.trim() !== "") {
    console.log("📸 Setting photo:", currentPhotoUrl);
    avatarImg.src = currentPhotoUrl;

    avatarImg.onload = function () {
      console.log("✅ Photo loaded successfully");
      if (removeBtn) removeBtn.style.display = "inline-block";
    };

    avatarImg.onerror = function () {
      console.error("❌ Failed to load photo:", currentPhotoUrl);
      avatarImg.src =
        "https://via.placeholder.com/80/dee2e6/6c757d?text=Load+Failed";
      if (removeBtn) removeBtn.style.display = "none";
    };
  } else {
    console.log("ℹ️ No photo URL, showing placeholder");
    avatarImg.src =
      "https://via.placeholder.com/80/dee2e6/6c757d?text=No+Photo";
    if (removeBtn) removeBtn.style.display = "none";
  }
}

// Photo selection
document
  .getElementById("profilePhotoInput")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      showToast("File too large. Max 2MB.", true);
      e.target.value = "";
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Please select JPG or PNG only.", true);
      e.target.value = "";
      return;
    }

    selectedFile = file;
    console.log("✅ File selected:", file.name);

    // Preview
    const reader = new FileReader();
    reader.onload = function (e) {
      const avatarImg = document.getElementById("userAvatarImg");
      const removeBtn = document.getElementById("removePhotoBtn");

      if (avatarImg) avatarImg.src = e.target.result;
      if (removeBtn) removeBtn.style.display = "inline-block";

      showToast("Photo preview ready: " + file.name, false);
    };
    reader.readAsDataURL(file);
  });

// Remove photo
document
  .getElementById("removePhotoBtn")
  .addEventListener("click", function (e) {
    e.preventDefault();
    selectedFile = null;
    currentPhotoUrl = null;

    document.getElementById("profilePhotoInput").value = "";

    const avatarImg = document.getElementById("userAvatarImg");
    if (avatarImg) {
      avatarImg.src =
        "https://via.placeholder.com/80/dee2e6/6c757d?text=Removed";
    }

    this.style.display = "none";
    showToast("Photo removed", false);
  });

// Form submission
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Please enter a valid email address", true);
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    submitBtn.disabled = true;

    const db = firebase.firestore();
    const storage = firebase.storage();
    const storageRef = storage.ref();

    try {
      let updateData = {
        fullName: fullName,
        email: email,
        role: role,
        adminNotes: adminNotes,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      // Upload new photo if selected
      if (selectedFile) {
        showUploadProgress(true);

        const timestamp = Date.now();
        const fileName = `profile_images/${currentUserId}_${timestamp}.jpg`;
        const uploadRef = storageRef.child(fileName);
        const uploadTask = uploadRef.put(selectedFile);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              const progressBar = document.getElementById("progressBar");
              const progressText = document.getElementById("progressText");

              if (progressBar) {
                progressBar.style.width = progress + "%";
                progressBar.textContent = progress + "%";
              }
              if (progressText) {
                progressText.textContent = `Uploading: ${progress}%`;
              }
            },
            (error) => {
              console.error("❌ Upload error:", error);
              showUploadProgress(false);
              reject(error);
            },
            async () => {
              try {
                const photoUrl = await uploadRef.getDownloadURL();
                updateData.photoUrl = photoUrl;
                currentPhotoUrl = photoUrl;
                console.log("✅ New photo URL:", photoUrl);

                showUploadProgress(false);
                resolve();
              } catch (urlError) {
                showUploadProgress(false);
                reject(urlError);
              }
            }
          );
        });
      } else if (currentPhotoUrl === null) {
        updateData.photoUrl = firebase.firestore.FieldValue.delete();
      }

      // Update Firestore
      await db.collection("users").doc(currentUserId).update(updateData);

      // ✅ Update Firebase Authentication email if changed
      if (email !== originalEmail) {
        console.log("📧 Email changed, updating Firebase Auth...");
        try {
          // Call Cloud Function to update auth email
          const updateAuthEmail = firebase
            .functions()
            .httpsCallable("updateUserEmail");
          const result = await updateAuthEmail({
            uid: currentUserId,
            newEmail: email,
          });

          if (result.data.success) {
            console.log("✅ Firebase Auth email updated successfully");
          } else {
            throw new Error(result.data.error || "Failed to update auth email");
          }
        } catch (authError) {
          console.error("❌ Auth update error:", authError);
          // Still show success for Firestore update, but warn about auth
          showToast(
            "Profile updated, but auth email update failed: " +
              authError.message,
            true
          );

          // Revert Firestore email to original
          await db.collection("users").doc(currentUserId).update({
            email: originalEmail,
          });

          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          return;
        }
      }

      const photoStatus = selectedFile
        ? "Updated"
        : currentPhotoUrl
        ? "Kept"
        : "Removed";
      const activityDescription = `Updated user profile for ${fullName} (Photo: ${photoStatus})${
        email !== originalEmail
          ? `, Email changed from ${originalEmail} to ${email}`
          : ""
      }${adminNotes ? ". Reason: " + adminNotes : ""}`;

      logActivity("user_updated", activityDescription);

      showToast("Profile updated successfully!", false);

      // Update preview
      displayUserPhoto();

      setTimeout(() => {
        window.location.href = `user-details.html?userId=${currentUserId}`;
      }, 2000);
    } catch (error) {
      console.error("❌ Error:", error);
      showToast("Error: " + error.message, true);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      showUploadProgress(false);
    }
  });

function showUploadProgress(show) {
  const progressContainer = document.getElementById("uploadProgress");
  if (!progressContainer) return;

  if (show) {
    progressContainer.style.display = "block";
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    if (progressBar) {
      progressBar.style.width = "0%";
      progressBar.textContent = "0%";
    }
    if (progressText) progressText.textContent = "Preparing...";
  } else {
    progressContainer.style.display = "none";
  }
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
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function goBack() {
  window.location.href = `user-details.html?userId=${currentUserId}`;
}

function showToast(msg, isError = false) {
  const toastElem = document.getElementById("savedToast");
  if (!toastElem) return;

  const toastBody = toastElem.querySelector(".toast-body");
  if (!toastBody) return;

  toastBody.innerHTML =
    (isError
      ? '<i class="bi bi-x-circle me-2 text-danger"></i>'
      : '<i class="bi bi-check-circle me-2"></i>') + msg;

  toastElem.className = `toast align-items-center border-0 ${
    isError ? "text-bg-danger" : "text-bg-success"
  }`;

  const toast = new bootstrap.Toast(toastElem, { delay: 3000 });
  toast.show();
}

function logActivity(action, description) {
  const db = firebase.firestore();
  const user = firebase.auth().currentUser;
  if (!user) return;

  db.collection("activityLog")
    .add({
      action: action,
      description: description,
      adminEmail: user.email,
      userId: currentUserId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch(console.error);
}

document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  logActivity("admin_logout", "Admin logged out");
  firebase
    .auth()
    .signOut()
    .then(() => {
      window.location.href = "index.html";
    })
    .catch((error) => {
      showToast("Logout failed: " + error.message, true);
    });
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("🌐 Edit User Profile page loaded");
  console.log("👤 User ID:", currentUserId);
});

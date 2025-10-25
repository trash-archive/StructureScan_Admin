// Secondary Firebase app for creating users without logout
const secondaryApp = firebase.initializeApp(
  {
    apiKey: firebase.app().options.apiKey,
    authDomain: firebase.app().options.authDomain,
    projectId: firebase.app().options.projectId,
  },
  "Secondary"
);

// Global variable for selected photo
let selectedPhotoFile = null;

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
    });
});

// ✅ Handle profile photo selection
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

    selectedPhotoFile = file;
    console.log("✅ Photo selected:", file.name);

    // Preview the photo
    const reader = new FileReader();
    reader.onload = function (e) {
      const avatarImg = document.getElementById("userAvatarImg");
      const removeBtn = document.getElementById("removePhotoBtn");

      if (avatarImg) avatarImg.src = e.target.result;
      if (removeBtn) removeBtn.style.display = "inline-block";

      showToast("Photo preview ready", false);
    };
    reader.readAsDataURL(file);
  });

// ✅ Handle remove photo
document
  .getElementById("removePhotoBtn")
  .addEventListener("click", function (e) {
    e.preventDefault();
    selectedPhotoFile = null;

    document.getElementById("profilePhotoInput").value = "";

    const avatarImg = document.getElementById("userAvatarImg");
    if (avatarImg) {
      avatarImg.src =
        "https://via.placeholder.com/80/dee2e6/6c757d?text=No+Photo";
    }

    this.style.display = "none";
    showToast("Photo removed", false);
  });

// Handle form submission
document.getElementById("addUserForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const fullName = document.getElementById("newFullName").value.trim();
  const email = document.getElementById("newEmail").value.trim();
  const role = document.getElementById("newRole").value;
  const password = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("newConfirmPassword").value;

  // Validation
  if (!fullName || !email || !role || !password || !confirmPassword) {
    showToast("Please fill in all required fields", true);
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters", true);
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match", true);
    return;
  }

  // Show loading state
  const btn = document.getElementById("createUserBtn");
  const spinner = document.getElementById("createUserSpinner");
  btn.disabled = true;
  spinner.classList.remove("d-none");

  const db = firebase.firestore();
  const storage = firebase.storage();
  const storageRef = storage.ref();

  console.log("🚀 Creating new user:", email);

  // Create user with SECONDARY Firebase instance
  secondaryApp
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const newUser = userCredential.user;
      const newUserId = newUser.uid;

      console.log("✅ User created in Auth:", newUserId);

      // Prepare user data
      let userData = {
        fullName: fullName,
        email: email,
        userId: newUserId,
        role: role,
        status: "active",
        isSuspended: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isAdmin: false,
      };

      // ✅ Upload profile photo if selected
      if (selectedPhotoFile) {
        console.log("📤 Uploading profile photo...");

        const timestamp = Date.now();
        const fileName = `profile_images/${newUserId}_${timestamp}.jpg`;
        const uploadRef = storageRef.child(fileName);
        const uploadTask = uploadRef.put(selectedPhotoFile);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              console.log(`📤 Upload progress: ${progress}%`);
            },
            (error) => {
              console.error("❌ Photo upload error:", error);
              reject(error);
            },
            async () => {
              try {
                const photoUrl = await uploadRef.getDownloadURL();
                userData.photoUrl = photoUrl;
                console.log("✅ Photo uploaded:", photoUrl);
                resolve();
              } catch (urlError) {
                console.error("❌ Error getting download URL:", urlError);
                reject(urlError);
              }
            }
          );
        })
          .then(() => {
            // Create Firestore document with photo URL
            return db.collection("users").doc(newUserId).set(userData);
          })
          .then(() => {
            return secondaryApp.auth().signOut();
          })
          .then(() => {
            logActivity(
              "user_created",
              `Created new user: ${fullName} (${email}) with role: ${role} and profile photo`
            );

            showToast("User created successfully with profile photo!", false);

            setTimeout(() => {
              window.location.href = "users.html";
            }, 1500);
          });
      } else {
        // No photo - create user without photoUrl
        console.log("ℹ️ No photo selected, creating user without photo");

        return db
          .collection("users")
          .doc(newUserId)
          .set(userData)
          .then(() => {
            return secondaryApp.auth().signOut();
          })
          .then(() => {
            logActivity(
              "user_created",
              `Created new user: ${fullName} (${email}) with role: ${role}`
            );

            showToast("User created successfully!", false);

            setTimeout(() => {
              window.location.href = "users.html";
            }, 1500);
          });
      }
    })
    .catch((error) => {
      console.error("❌ Error creating user:", error);
      let errorMessage = "Error creating user: " + error.message;

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      }

      showToast(errorMessage, true);
    })
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add("d-none");
    });
});

// Toast notification
function showToast(msg, isError = false) {
  const toastElem = document.getElementById("savedToast");
  const toastBody = toastElem.querySelector(".toast-body");

  toastBody.innerHTML =
    (isError
      ? '<i class="bi bi-x-circle me-2"></i>'
      : '<i class="bi bi-check-circle me-2"></i>') + msg;

  toastElem.className = `toast align-items-center border-0 ${
    isError ? "text-bg-danger" : "text-bg-success"
  }`;

  const toast = new bootstrap.Toast(toastElem, { delay: 3000 });
  toast.show();
}

// Log activity
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
      console.error("❌ Activity logging failed:", error);
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

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("🌐 Add User page loaded");
});

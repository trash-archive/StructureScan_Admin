// Secondary Firebase app for creating users without logout
const secondaryApp = firebase.initializeApp(
  {
    apiKey: firebase.app().options.apiKey,
    authDomain: firebase.app().options.authDomain,
    projectId: firebase.app().options.projectId,
  },
  "Secondary"
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
    });
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

  // Create user with SECONDARY Firebase instance (won't log you out!)
  secondaryApp
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const newUser = userCredential.user;
      const newUserId = newUser.uid;

      // Create user document in Firestore
      return db
        .collection("users")
        .doc(newUserId)
        .set({
          fullName: fullName,
          email: email,
          userId: newUserId,
          role: role,
          status: "active",
          isSuspended: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isAdmin: false,
        })
        .then(() => {
          // Sign out the new user from secondary app
          return secondaryApp.auth().signOut();
        })
        .then(() => {
          // Log activity
          logActivity(
            "user_created",
            `Created new user: ${fullName} (${email}) with role: ${role}`
          );

          showToast("User created successfully!", false);

          // Redirect back to users page after 1.5 seconds
          setTimeout(() => {
            window.location.href = "users.html";
          }, 1500);
        });
    })
    .catch((error) => {
      console.error("Error creating user:", error);
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
  toastElem.querySelector(".toast-body").innerHTML =
    (isError
      ? '<i class="bi bi-x-circle me-2"></i>'
      : '<i class="bi bi-check-circle me-2"></i>') + msg;
  toastElem.classList.toggle("text-bg-success", !isError);
  toastElem.classList.toggle("text-bg-danger", isError);
  const toast = new bootstrap.Toast(toastElem, { delay: 2500 });
  toast.show();
}

// Log activity
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

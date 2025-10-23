// Pagination settings
const USERS_PER_PAGE = 6;
let currentPage = 1;
let allUsers = [];
let filteredUsers = [];

// =============================
// 🔹 Auth & Admin Verification
// =============================
firebase.auth().onAuthStateChanged(function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const db = firebase.firestore();
  const adminAvatar = document.getElementById("adminAvatar");
  const adminNameElem = document.getElementById("adminName");

  db.collection("users")
    .doc(user.uid)
    .get()
    .then((doc) => {
      if (!doc.exists || !doc.data().isAdmin) {
        showToast("Access denied. Admin only.", true);
        firebase.auth().signOut();
        window.location.href = "index.html";
        return;
      }

      const adminData = doc.data();
      const displayName = adminData.fullName || user.email.split("@")[0];
      adminNameElem.textContent = displayName;

      // ✅ Display photo or initial
      if (adminData.photoUrl1) {
        adminAvatar.innerHTML = `
          <img src="${adminData.photoUrl1}" 
               alt="Admin Avatar" 
               class="rounded-circle" 
               width="40" height="40"
               style="object-fit: cover;">
        `;
      } else {
        const initial = displayName.charAt(0).toUpperCase();
        adminAvatar.innerHTML = `
          <div class="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center"
               style="width: 40px; height: 40px; font-size: 16px;">
            ${initial}
          </div>
        `;
      }

      // Load all users
      loadUsers();
    })
    .catch((error) => {
      console.error("Error checking admin status:", error);
      showToast("Error verifying admin.", true);
    });
});

// =============================
// 🔹 Load Users from Firestore
// =============================
async function loadUsers() {
  const db = firebase.firestore();
  const tableBody = document.getElementById("usersTableBody");

  try {
    const snapshot = await db.collection("users").get();

    if (snapshot.empty) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-muted">No users found</td></tr>';
      return;
    }

    allUsers = [];

    for (const doc of snapshot.docs) {
      const userData = doc.data();

      // Skip admin users
      if (userData.isAdmin) continue;

      const assessmentsSnapshot = await db
        .collection("users")
        .doc(doc.id)
        .collection("assessments")
        .get();

      allUsers.push({
        id: doc.id,
        fullName: userData.fullName || "N/A",
        email: userData.email || "N/A",
        photoUrl: userData.photoUrl1 || null,
        assessmentCount: assessmentsSnapshot.size,
        status: userData.status || "active",
        userId: userData.userId || doc.id,
      });
    }

    updateStats();
    applyFilters();
  } catch (error) {
    console.error("Error loading users:", error);
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-4">Error loading users</td></tr>';
  }
}

// =============================
// 🔹 Statistics Summary
// =============================
function updateStats() {
  const total = allUsers.length;
  const active = allUsers.filter((u) => u.status === "active").length;
  const suspended = allUsers.filter((u) => u.status === "suspended").length;

  document.getElementById("totalUsers").textContent = total;
  document.getElementById("activeUsers").textContent = active;
  document.getElementById("suspendedUsers").textContent = suspended;
}

// =============================
// 🔹 Filtering & Searching
// =============================
function applyFilters() {
  const searchTerm = document.getElementById("searchUser").value.toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;

  filteredUsers = allUsers.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  currentPage = 1;
  renderUsers();
  renderPagination();
}

// =============================
// 🔹 Render Users with Avatar
// =============================
function renderUsers() {
  const tableBody = document.getElementById("usersTableBody");
  const start = (currentPage - 1) * USERS_PER_PAGE;
  const end = start + USERS_PER_PAGE;
  const usersToShow = filteredUsers.slice(start, end);

  if (usersToShow.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-muted">No users found</td></tr>';
    return;
  }

  tableBody.innerHTML = "";
  usersToShow.forEach((user) => {
    // ✅ Profile photo or initial avatar
    let profileContent = "";
    if (user.photoUrl) {
      profileContent = `
        <img src="${user.photoUrl}" 
             alt="Profile" 
             class="rounded-circle" 
             width="40" height="40"
             style="object-fit: cover;"
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}'">
      `;
    } else {
      const initial = user.fullName
        ? user.fullName.charAt(0).toUpperCase()
        : "U";
      profileContent = `
        <div class="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center"
             style="width: 40px; height: 40px; font-size: 16px;">
          ${initial}
        </div>
      `;
    }

    const statusBadge =
      user.status === "active"
        ? '<span class="badge bg-success">Active</span>'
        : '<span class="badge bg-warning">Suspended</span>';

    const row = `
      <tr>
        <td>${profileContent}</td>
        <td>${user.fullName}</td>
        <td>${user.email}</td>
        <td><span class="badge bg-primary">${user.assessmentCount}</span></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewUser('${user.id}')">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });

  const totalUsers = filteredUsers.length;
  const showing = usersToShow.length;
  document.getElementById("paginationInfo").textContent = `Showing ${
    start + 1
  }-${start + showing} of ${totalUsers} users`;
}

// =============================
// 🔹 Pagination Controls
// =============================
function renderPagination() {
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const pagination = document.getElementById("pagination");

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">
        <i class="bi bi-chevron-left"></i>
      </a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      html += `
        <li class="page-item ${i === currentPage ? "active" : ""}">
          <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        </li>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  html += `
    <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
      <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">
        <i class="bi bi-chevron-right"></i>
      </a>
    </li>
  `;

  pagination.innerHTML = html;
}

function changePage(page) {
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderUsers();
  renderPagination();
  document
    .querySelector(".table-responsive")
    .scrollIntoView({ behavior: "smooth" });
}

// =============================
// 🔹 Utility & Actions
// =============================
function viewUser(userId) {
  window.location.href = `user-details.html?userId=${userId}`;
}

function addNewUser() {
  window.location.href = "add-user.html";
}

// ✅ Custom Toast Message
function showToast(msg, isError = false) {
  const toastElem = document.getElementById("savedToast");
  toastElem.querySelector(".toast-body").innerHTML =
    (isError
      ? '<i class="bi bi-x-circle me-2"></i>'
      : '<i class="bi bi-check-circle me-2"></i>') + msg;
  toastElem.classList.toggle("text-bg-success", !isError);
  toastElem.classList.toggle("text-bg-danger", isError);
  new bootstrap.Toast(toastElem, { delay: 2500 }).show();
}

// ✅ Log activity
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

// ✅ Search & Filter Events
document.getElementById("searchUser").addEventListener("input", applyFilters);
document
  .getElementById("filterStatus")
  .addEventListener("change", applyFilters);

// ✅ Logout
document.getElementById("logoutBtn").addEventListener("click", function (e) {
  e.preventDefault();
  logActivity("logout", "Admin logged out");
  firebase
    .auth()
    .signOut()
    .then(() => (window.location.href = "index.html"));
});

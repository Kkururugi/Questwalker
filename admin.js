import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc,
  query,
  where,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbLK26irLxdz03rDCMVHnqHYfDgBjn10g",
  authDomain: "questwalker-5c547.firebaseapp.com",
  projectId: "questwalker-5c547",
  storageBucket: "questwalker-5c547.appspot.com",
  messagingSenderId: "1058097550838",
  appId: "1:1058097550838:web:7bdbb645be374c93e4e3d7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentAdminId = null;
let currentReportId = null;

// DOM Elements
const elements = {
  reportsTab: document.getElementById("reports-tab"),
  usersTab: document.getElementById("users-tab"),
  questsTab: document.getElementById("quests-tab"),
  reportsPanel: document.getElementById("reports-panel"),
  usersPanel: document.getElementById("users-panel"),
  questsPanel: document.getElementById("quests-panel"),
  reportsList: document.getElementById("reports-list"),
  usersList: document.getElementById("users-list"),
  questsList: document.getElementById("quests-list"),
  reportStatusFilter: document.getElementById("report-status-filter"),
  refreshReports: document.getElementById("refresh-reports"),
  userSearch: document.getElementById("user-search"),
  searchUsers: document.getElementById("search-users"),
  questSearch: document.getElementById("quest-search"),
  searchQuests: document.getElementById("search-quests"),
  actionModal: document.getElementById("action-modal"),
  closeActionModal: document.getElementById("close-action"),
  actionTitle: document.getElementById("action-title"),
  reportDetailsContainer: document.getElementById("report-details-container"),
  banUserBtn: document.getElementById("ban-user"),
  removeQuestBtn: document.getElementById("remove-quest"),
  dismissReportBtn: document.getElementById("dismiss-report"),
  adminEmail: document.getElementById("admin-email"),
  logoutAdmin: document.getElementById("logout-admin"),
    banConfirmModal: document.getElementById("ban-confirm-modal"),
  closeBanConfirmModal: document.getElementById("close-ban-confirm"),
  banConfirmDetails: document.getElementById("ban-confirm-details"),
  confirmBanBtn: document.getElementById("confirm-ban"),
  cancelBanBtn: document.getElementById("cancel-ban"),
};

function init() {
  checkAuthState();
  setupEventListeners();
}

function setupEventListeners() {
  elements.reportsTab.addEventListener("click", () => switchTab("reports"));
  elements.usersTab.addEventListener("click", () => switchTab("users"));
  elements.questsTab.addEventListener("click", () => switchTab("quests"));

  elements.reportStatusFilter.addEventListener("change", loadReports);
  elements.refreshReports.addEventListener("click", loadReports);

  elements.searchUsers.addEventListener("click", () => {
    const searchTerm = elements.userSearch.value.trim();
    loadUsers(searchTerm);
  });

  elements.searchQuests.addEventListener("click", () => {
    const searchTerm = elements.questSearch.value.trim();
    loadQuests(searchTerm);
  });

  elements.closeActionModal.addEventListener("click", () => {
    elements.actionModal.classList.add("hidden");
  });

  elements.banUserBtn.addEventListener("click", banUser);
  elements.removeQuestBtn.addEventListener("click", removeQuest);
  elements.dismissReportBtn.addEventListener("click", dismissReport);

  elements.logoutAdmin.addEventListener("click", adminLogout);
}

function switchTab(tabName) {
  elements.reportsTab.classList.remove("active");
  elements.usersTab.classList.remove("active");
  elements.questsTab.classList.remove("active");

  elements.reportsPanel.classList.remove("active");
  elements.usersPanel.classList.remove("active");
  elements.questsPanel.classList.remove("active");

  if (tabName === "reports") {
    elements.reportsTab.classList.add("active");
    elements.reportsPanel.classList.add("active");
    loadReports();
  } else if (tabName === "users") {
    elements.usersTab.classList.add("active");
    elements.usersPanel.classList.add("active");
    loadUsers();
  } else if (tabName === "quests") {
    elements.questsTab.classList.add("active");
    elements.questsPanel.classList.add("active");
    loadQuests();
  }
    elements.closeBanConfirmModal.addEventListener("click", () => {
    elements.banConfirmModal.classList.add("hidden");
  });
  
  elements.cancelBanBtn.addEventListener("click", () => {
    elements.banConfirmModal.classList.add("hidden");
  });
  
  elements.confirmBanBtn.addEventListener("click", executeBan);
}


async function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        currentAdminId = user.uid;
        elements.adminEmail.textContent = user.email;
        loadReports();
      } else {
        alert("You don't have admin privileges.");
        window.location.href = "homepage.html";
      }
    } else {
      window.location.href = "index.html";
    }
  });
}

async function adminLogout() {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error signing out:", error);
    alert("Failed to logout. Please try again.");
  }
}

async function loadReports() {
  try {
    const statusFilter = elements.reportStatusFilter.value;
    let q;

    if (statusFilter === "all") {
      q = collection(db, "reports");
    } else {
      q = query(collection(db, "reports"), where("status", "==", statusFilter));
    }

    const querySnapshot = await getDocs(q);
    elements.reportsList.innerHTML = '';

    if (querySnapshot.empty) {
      elements.reportsList.innerHTML = "<p>No reports found.</p>";
      return;
    }

    // Prepare an array to hold promises for fetching reporter names
    const reportsWithNames = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      const report = docSnap.data();
      const reportId = docSnap.id;

      let reporterName = "Unknown Reporter";
      if (report.reportedBy) {
        try {
          const reporterDoc = await getDoc(doc(db, "users", report.reportedBy));
          if (reporterDoc.exists()) {
            const reporterData = reporterDoc.data();
            reporterName = `${reporterData.firstName || ''} ${reporterData.lastName || ''}`.trim() || "Unknown Reporter";
          }
        } catch (err) {
          console.error("Failed to fetch reporter user data", err);
        }
      }

      return { reportId, report, reporterName };
    }));

    // Render reports with reporter names
    reportsWithNames.forEach(({ reportId, report, reporterName }) => {
      const reportElement = document.createElement("div");
      reportElement.className = "report-item";
      reportElement.innerHTML = `
        <h3>${report.questTitle}</h3>
        <p><strong>Reason:</strong> ${report.reason}</p>
        <p><strong>Reported By:</strong> ${reporterName}</p>
        <p><strong>Status:</strong> <span class="status-${report.status}">${report.status}</span></p>
        <p><strong>Date:</strong> ${new Date(report.timestamp?.seconds * 1000).toLocaleString()}</p>
        <button class="view-report-btn" data-report-id="${reportId}">View Details</button>
      `;

      reportElement.querySelector('.view-report-btn').addEventListener('click', () => {
        openActionModal(reportId, report);
      });

      elements.reportsList.appendChild(reportElement);
    });
  } catch (error) {
    console.error("Error loading reports:", error);
    elements.reportsList.innerHTML = "<p>Error loading reports. Please try again.</p>";
  }
}


async function loadUsers(searchTerm = '') {
  try {
    const q = collection(db, "users");
    const querySnapshot = await getDocs(q);
    elements.usersList.innerHTML = '';

    if (querySnapshot.empty) {
      elements.usersList.innerHTML = "<p>No users found.</p>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;

      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      if (searchTerm && !fullName.includes(searchTerm.toLowerCase())) {
        return;
      }

      const userElement = document.createElement("div");
      userElement.className = "user-item";
      userElement.innerHTML = `
        <h3>${user.firstName || 'No'} ${user.lastName || 'Name'}</h3>
        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
        <p><strong>Role:</strong> ${user.role || 'user'}</p>
        <p><strong>Status:</strong> <span class="status-${user.banned ? 'banned' : 'active'}">
          ${user.banned ? 'Banned' : 'Active'}
        </span></p>
        <div class="user-actions">
          ${user.role !== 'admin' ? `
            <button class="${user.banned ? 'unban-user-btn' : 'ban-user-btn'}" data-user-id="${userId}">
              ${user.banned ? 'Unban' : 'Ban'}
            </button>
          ` : ''}
          <button class="visit-profile-btn" data-user-id="${userId}">
            Visit Profile
          </button>
        </div>
      `;

      if (user.role !== 'admin') {
        const banBtn = userElement.querySelector('.ban-user-btn, .unban-user-btn');
        banBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showBanConfirmation(userId, user.banned, `${user.firstName} ${user.lastName}`);
        });
      }

      const profileBtn = userElement.querySelector('.visit-profile-btn');
      profileBtn.addEventListener('click', () => {
        // Redirect to user profile page with the user's ID
        window.location.href = `profile.html?id=${userId}`;
      });

      elements.usersList.appendChild(userElement);
    });
  } catch (error) {
    console.error("Error loading users:", error);
    elements.usersList.innerHTML = "<p>Error loading users. Please try again.</p>";
  }
}

function showBanConfirmation(userId, isBanned, userName) {
  elements.banConfirmDetails.innerHTML = `
    <p>Are you sure you want to ${isBanned ? 'unban' : 'ban'} <strong>${userName}</strong>?</p>
    ${!isBanned ? '<p>This will prevent the user from logging in or using the app.</p>' : ''}
  `;
  elements.confirmBanBtn.textContent = isBanned ? 'Yes, Unban User' : 'Yes, Ban User';
  elements.confirmBanBtn.dataset.userId = userId;
  elements.confirmBanBtn.dataset.currentlyBanned = isBanned;
  elements.banConfirmModal.classList.remove("hidden");
}

async function executeBan() {
  const userId = elements.confirmBanBtn.dataset.userId;
  const currentlyBanned = elements.confirmBanBtn.dataset.currentlyBanned === 'true';

  try {
    await updateDoc(doc(db, "users", userId), {
      banned: !currentlyBanned,
      bannedAt: !currentlyBanned ? new Date() : null,
      bannedBy: !currentlyBanned ? currentAdminId : null
    });

    alert(`User has been ${currentlyBanned ? "unbanned" : "banned"} successfully.`);
    elements.banConfirmModal.classList.add("hidden");
    loadUsers();
  } catch (error) {
    console.error("Error toggling ban status:", error);
    alert("Failed to update user status.");
  }
}


async function loadQuests(searchTerm = '') {
  try {
    const q = collection(db, "quests");
    const querySnapshot = await getDocs(q);
    elements.questsList.innerHTML = '';

    if (querySnapshot.empty) {
      elements.questsList.innerHTML = "<p>No quests found.</p>";
      return;
    }

    // Use Promise.all to wait for all posters' names before rendering
    const questsData = [];

    for (const docSnap of querySnapshot.docs) {
      const quest = docSnap.data();
      const questId = docSnap.id;

      if (searchTerm && !quest.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        continue;
      }

      let posterName = "Unknown";
      try {
        const posterDoc = await getDoc(doc(db, "users", quest.userId));
        if (posterDoc.exists()) {
          const posterData = posterDoc.data();
          posterName = `${posterData.firstName || ''} ${posterData.lastName || ''}`.trim() || "Unknown";
        }
      } catch (error) {
        console.error("Error fetching poster info:", error);
      }

      questsData.push({ quest, questId, posterName });
    }

    questsData.forEach(({ quest, questId, posterName }) => {
      const questElement = document.createElement("div");
      questElement.className = "quest-item";
      questElement.innerHTML = `
        <h3>${quest.title}</h3>
        <p><strong>Status:</strong> <span class="status-${quest.status || 'active'}">${quest.status || 'active'}</span></p>
        <p><strong>Posted By:</strong> ${posterName}</p>
        <p><strong>Posted On:</strong> ${new Date(quest.createdAt?.seconds * 1000).toLocaleDateString()}</p>
        <div class="quest-actions">
          <button class="remove-quest-btn" data-quest-id="${questId}">Remove Quest</button>
        </div>
      `;

      questElement.querySelector('.remove-quest-btn').addEventListener('click', () => {
        openActionModal(null, null, questId);
      });

      elements.questsList.appendChild(questElement);
    });
  } catch (error) {
    console.error("Error loading quests:", error);
    elements.questsList.innerHTML = "<p>Error loading quests. Please try again.</p>";
  }
}

function openActionModal(reportId = null, reportData = null, questId = null) {
  currentReportId = reportId;
  elements.actionModal.classList.remove("hidden");

  if (reportData) {
    elements.actionTitle.textContent = `Report: ${reportData.questTitle}`;
    elements.reportDetailsContainer.innerHTML = `
      <p><strong>Reason:</strong> ${reportData.reason}</p>
      <p><strong>Reported By:</strong> ${reportData.reportedBy}</p>
      <p><strong>Status:</strong> <span class="status-${reportData.status}">${reportData.status}</span></p>
      <p><strong>Details:</strong> ${reportData.details || "No additional details."}</p>
    `;

    elements.banUserBtn.style.display = "inline-block";
    elements.dismissReportBtn.style.display = "inline-block";
    elements.removeQuestBtn.style.display = "inline-block";
  } else if (questId) {
    elements.actionTitle.textContent = "Remove Quest";
    elements.reportDetailsContainer.innerHTML = `<p>Are you sure you want to remove this quest?</p>`;
    elements.banUserBtn.style.display = "none";
    elements.dismissReportBtn.style.display = "none";
    elements.removeQuestBtn.style.display = "inline-block";

    // Store quest id in the button dataset for removal
    elements.removeQuestBtn.dataset.questId = questId;
  } else {
    elements.actionTitle.textContent = "Action";
    elements.reportDetailsContainer.innerHTML = "";
    elements.banUserBtn.style.display = "none";
    elements.dismissReportBtn.style.display = "none";
    elements.removeQuestBtn.style.display = "none";
  }
}

async function banUser() {
  if (!currentReportId) return;

  try {
    // Get the report to find which user to ban
    const reportDoc = await getDoc(doc(db, "reports", currentReportId));
    if (!reportDoc.exists()) {
      alert("Report not found.");
      return;
    }

    const reportData = reportDoc.data();
    const userIdToBan = reportData.reportedUserId;
    if (!userIdToBan) {
      alert("No user to ban for this report.");
      return;
    }

    // Ban user by setting banned flag and disabling auth account
    await Promise.all([
      // Update Firestore user document
      updateDoc(doc(db, "users", userIdToBan), {
        banned: true,
        bannedAt: new Date(),
        bannedBy: currentAdminId
      }),
      
      // Disable auth account (requires Firebase Admin SDK on backend)
      // You'll need to implement a Cloud Function for this
      fetch('https://your-firebase-function-url/disableUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userIdToBan,
          adminId: currentAdminId
        })
      })
    ]);

    // Update report status to "resolved"
    await updateDoc(doc(db, "reports", currentReportId), {
      status: "resolved",
      resolvedBy: currentAdminId,
      resolvedAt: new Date()
    });

    alert("User banned and report resolved.");
    elements.actionModal.classList.add("hidden");
    loadReports();
    loadUsers();
  } catch (error) {
    console.error("Error banning user:", error);
    alert("Failed to ban user.");
  }
}

async function removeQuest() {
  let questId = elements.removeQuestBtn.dataset.questId;
  if (!questId && currentReportId) {
    // Remove quest associated with report
    const reportDoc = await getDoc(doc(db, "reports", currentReportId));
    if (reportDoc.exists()) {
      const reportData = reportDoc.data();
      questId = reportData.questId;
    }
  }

  if (!questId) {
    alert("No quest selected.");
    return;
  }

  try {
    await deleteDoc(doc(db, "quests", questId));

    if (currentReportId) {
      await updateDoc(doc(db, "reports", currentReportId), {
        status: "resolved",
        resolvedBy: currentAdminId,
        resolvedAt: new Date()
      });
    }

    alert("Quest removed successfully.");
    elements.actionModal.classList.add("hidden");
    loadReports();
    loadQuests();
  } catch (error) {
    console.error("Error removing quest:", error);
    alert("Failed to remove quest.");
  }
}

async function dismissReport() {
  if (!currentReportId) return;

  try {
    await updateDoc(doc(db, "reports", currentReportId), {
      status: "dismissed",
      resolvedBy: currentAdminId,
      resolvedAt: new Date()
    });

    alert("Report dismissed.");
    elements.actionModal.classList.add("hidden");
    loadReports();
  } catch (error) {
    console.error("Error dismissing report:", error);
    alert("Failed to dismiss report.");
  }
}

async function toggleUserBan(userId, currentlyBanned) {
  try {
    await updateDoc(doc(db, "users", userId), {
      banned: !currentlyBanned
    });
    alert(`User has been ${currentlyBanned ? "unbanned" : "banned"}.`);
    loadUsers();
  } catch (error) {
    console.error("Error toggling ban status:", error);
    alert("Failed to update user status.");
  }
}

async function makeAdmin(userId) {
  try {
    await updateDoc(doc(db, "users", userId), {
      role: "admin"
    });
    alert("User promoted to admin.");
    loadUsers();
  } catch (error) {
    console.error("Error making user admin:", error);
    alert("Failed to promote user.");
  }
}

init();

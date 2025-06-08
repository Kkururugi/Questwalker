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
  deleteDoc,
  orderBy,
  addDoc
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
let currentQuestId = null;

// DOM Elements
const elements = {
  dashboardTab: document.getElementById("dashboard-tab"),
  reportsTab: document.getElementById("reports-tab"),
  usersTab: document.getElementById("users-tab"),
  questsTab: document.getElementById("quests-tab"),
  dashboardPanel: document.getElementById("dashboard-panel"),
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
  warningModal: document.getElementById("warning-modal"),
  closeWarningModal: document.getElementById("close-warning"),
  sendWarningBtn: document.getElementById("send-warning"),
  cancelWarningBtn: document.getElementById("cancel-warning"),
  warningUserName: document.getElementById("warning-user-name"),
  warningMessage: document.getElementById("warning-message"),
  totalUsers: document.getElementById("total-users"),
  totalQuests: document.getElementById("total-quests"),
  openReports: document.getElementById("open-reports"),
  bannedUsers: document.getElementById("banned-users")
};

function init() {
  checkAuthState();
  setupEventListeners();
  elements.warningModal.classList.add("hidden");
}

function setupEventListeners() {
  // Tab navigation
  elements.dashboardTab.addEventListener("click", () => switchTab("dashboard"));
  elements.reportsTab.addEventListener("click", () => switchTab("reports"));
  elements.usersTab.addEventListener("click", () => switchTab("users"));
  elements.questsTab.addEventListener("click", () => switchTab("quests"));

  // Reports section
  elements.reportStatusFilter.addEventListener("change", loadReports);
  elements.refreshReports.addEventListener("click", loadReports);

  // Users section
  elements.userSearch.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const searchTerm = elements.userSearch.value.trim();
      loadUsers(searchTerm);
    }
  });
  elements.searchUsers.addEventListener("click", () => {
    const searchTerm = elements.userSearch.value.trim();
    loadUsers(searchTerm);
  });

  // Quests section
  elements.questSearch.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const searchTerm = elements.questSearch.value.trim();
      loadQuests(searchTerm);
    }
  });
  elements.searchQuests.addEventListener("click", () => {
    const searchTerm = elements.questSearch.value.trim();
    loadQuests(searchTerm);
  });

  // Modal controls
  elements.closeActionModal.addEventListener("click", () => {
    elements.actionModal.classList.add("hidden");
  });
  elements.closeBanConfirmModal.addEventListener("click", () => {
    elements.banConfirmModal.classList.add("hidden");
  });
  elements.cancelBanBtn.addEventListener("click", () => {
    elements.banConfirmModal.classList.add("hidden");
  });
  elements.closeWarningModal.addEventListener("click", () => {
    elements.warningModal.classList.add("hidden");
  });
  elements.cancelWarningBtn.addEventListener("click", () => {
    elements.warningModal.classList.add("hidden");
  });

  // Action buttons
  elements.confirmBanBtn.addEventListener("click", executeBan);
  elements.sendWarningBtn.addEventListener("click", sendWarning);
  elements.banUserBtn.addEventListener("click", banUser);
  elements.removeQuestBtn.addEventListener("click", removeQuest);
  elements.dismissReportBtn.addEventListener("click", dismissReport);

  // Logout
  elements.logoutAdmin.addEventListener("click", adminLogout);
}

function switchTab(tabName) {
  // Remove 'active' from all sidebar <li>
  document.querySelectorAll('.sidebar-nav ul li').forEach(li => li.classList.remove('active'));

  // Reset active state for all tabs and panels
  elements.dashboardTab.classList.remove("active");
  elements.reportsTab.classList.remove("active");
  elements.usersTab.classList.remove("active");
  elements.questsTab.classList.remove("active");

  elements.dashboardPanel.classList.remove("active");
  elements.reportsPanel.classList.remove("active");
  elements.usersPanel.classList.remove("active");
  elements.questsPanel.classList.remove("active");

  // Set active state for selected tab and panel
  switch(tabName) {
    case "dashboard":
      elements.dashboardTab.classList.add("active");
      elements.dashboardPanel.classList.add("active");
      elements.dashboardTab.closest('li').classList.add('active');
      loadDashboard();
      break;
    case "reports":
      elements.reportsTab.classList.add("active");
      elements.reportsPanel.classList.add("active");
      elements.reportsTab.closest('li').classList.add('active');
      loadReports();
      break;
    case "users":
      elements.usersTab.classList.add("active");
      elements.usersPanel.classList.add("active");
      elements.usersTab.closest('li').classList.add('active');
      loadUsers();
      break;
    case "quests":
      elements.questsTab.classList.add("active");
      elements.questsPanel.classList.add("active");
      elements.questsTab.closest('li').classList.add('active');
      loadQuests();
      break;
  }
}

async function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        currentAdminId = user.uid;
        elements.adminEmail.textContent = user.email;
        loadDashboard();
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

async function loadDashboard() {
  try {
    // Load stats
    const [usersCount, questsCount, reportsCount, bannedCount] = await Promise.all([
      getCollectionCount("users"),
      getCollectionCount("quests"),
      getCollectionCount("reports", where("status", "==", "open")),
      getCollectionCount("users", where("banned", "==", true))
    ]);

    elements.totalUsers.textContent = usersCount;
    elements.totalQuests.textContent = questsCount;
    elements.openReports.textContent = reportsCount;
    elements.bannedUsers.textContent = bannedCount;

    // Load Chart.js library dynamically
    await loadScript("https://cdn.jsdelivr.net/npm/chart.js");
    
    // Get data for charts
    const [reportsData, questsData, usersData] = await Promise.all([
      getTimeSeriesData('reports'),
      getTimeSeriesData('quests'),
      getTimeSeriesData('users')
    ]);
    
    // Clear previous charts if they exist
    const chartContainers = ['reports-chart', 'quests-chart', 'users-chart'];
    chartContainers.forEach(id => {
      const container = document.getElementById(id);
      container.innerHTML = '<canvas></canvas>';
    });
    
    // Render charts
    renderChart('reports-chart', 'Reports', reportsData);
    renderChart('quests-chart', 'Quests', questsData);
    renderChart('users-chart', 'User Signups', usersData);
  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
}

async function getCollectionCount(collectionName, whereClause = null) {
  try {
    let q;
    if (whereClause) {
      q = query(collection(db, collectionName), whereClause);
    } else {
      q = collection(db, collectionName);
    }
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error(`Error counting ${collectionName}:`, error);
    return 0;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function getTimeSeriesData(collectionName) {
  const q = query(collection(db, collectionName), 
    orderBy('createdAt' || 'timestamp', 'asc'));
  
  const snapshot = await getDocs(q);
  const dataByDate = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const date = data.createdAt?.toDate() || data.timestamp?.toDate() || new Date();
    const dateStr = date.toISOString().split('T')[0];
    
    if (!dataByDate[dateStr]) {
      dataByDate[dateStr] = 0;
    }
    dataByDate[dateStr]++;
  });
  
  return {
    labels: Object.keys(dataByDate),
    data: Object.values(dataByDate)
  };
}

function renderChart(elementId, label, chartData) {
  const ctx = document.getElementById(elementId).querySelector('canvas').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: label,
        data: chartData.data,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          precision: 0
        }
      }
    }
  });
}

async function loadReports() {
  try {
    const statusFilter = elements.reportStatusFilter.value;
    let q;

    // Try to order by timestamp, fallback to createdAt if needed
    if (statusFilter === "all") {
      q = query(
        collection(db, "reports"),
        orderBy("timestamp", "desc")
      );
    } else {
      q = query(
        collection(db, "reports"),
        where("status", "==", statusFilter),
        orderBy("timestamp", "desc")
      );
    }

    let querySnapshot = await getDocs(q);

    // If no results and ordering by timestamp, try createdAt
    if (querySnapshot.empty) {
      if (statusFilter === "all") {
        q = query(
          collection(db, "reports"),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(
          collection(db, "reports"),
          where("status", "==", statusFilter),
          orderBy("createdAt", "desc")
        );
      }
      querySnapshot = await getDocs(q);
    }

    elements.reportsList.innerHTML = '';

    if (querySnapshot.empty) {
      elements.reportsList.innerHTML = "<p>No reports found.</p>";
      return;
    }

    // Prepare an array to hold promises for fetching additional data
    const reportsWithData = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      const report = docSnap.data();
      const reportId = docSnap.id;

      // Fetch reporter name
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

      // Fetch quest title
      let questTitle = "Untitled Quest";
      if (report.questId) {
        try {
          const questDoc = await getDoc(doc(db, "quests", report.questId));
          if (questDoc.exists()) {
            questTitle = questDoc.data().title || "Untitled Quest";
          }
        } catch (err) {
          console.error("Failed to fetch quest data", err);
        }
      } else if (report.questTitle) {
        questTitle = report.questTitle;
      }

      return { reportId, report, reporterName, questTitle };
    }));

    // Render reports with all the fetched data
    reportsWithData.forEach(({ reportId, report, reporterName, questTitle }) => {
      const reportElement = document.createElement("div");
      reportElement.className = "report-item";
      reportElement.innerHTML = `
        <h3>${questTitle}</h3>
        <p><strong>Reason:</strong> ${report.reason}</p>
        <p><strong>Reported By:</strong> ${reporterName}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${report.status}">${report.status}</span></p>
        <p><strong>Date:</strong> ${report.timestamp?.toDate().toLocaleString() || 'Unknown date'}</p>
        <div class="item-actions">
          <button class="btn btn-primary view-report-btn" data-report-id="${reportId}">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      `;

      reportElement.querySelector('.view-report-btn').addEventListener('click', () => {
        openActionModal(reportId, { ...report, questTitle });
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
    const q = query(collection(db, "users"), orderBy("firstName", "asc"));
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
        <p><strong>Status:</strong> <span class="status-badge status-${user.banned ? 'banned' : 'active'}">
          ${user.banned ? 'Banned' : 'Active'}
        </span></p>
        <div class="item-actions">
          ${user.role !== 'admin' ? `
            <button class="btn ${user.banned ? 'btn-success' : 'btn-danger'} ban-user-btn" data-user-id="${userId}">
              <i class="fas ${user.banned ? 'fa-unlock' : 'fa-ban'}"></i> ${user.banned ? 'Unban' : 'Ban'}
            </button>
            <button class="btn btn-warning warn-user-btn" data-user-id="${userId}">
              <i class="fas fa-exclamation-triangle"></i> Warn
            </button>
          ` : ''}
          <button class="btn btn-primary visit-profile-btn" data-user-id="${userId}">
            <i class="fas fa-user"></i> Visit Profile
          </button>
        </div>
      `;

      if (user.role !== 'admin') {
        const banBtn = userElement.querySelector('.ban-user-btn');
        banBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showBanConfirmation(userId, user.banned, `${user.firstName} ${user.lastName}`);
        });

        const warnBtn = userElement.querySelector('.warn-user-btn');
        warnBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showWarningModal(userId, `${user.firstName} ${user.lastName}`);
        });
      }

      const profileBtn = userElement.querySelector('.visit-profile-btn');
      profileBtn.addEventListener('click', () => {
        window.location.href = `profile.html?id=${userId}`;
      });

      elements.usersList.appendChild(userElement);
    });
  } catch (error) {
    console.error("Error loading users:", error);
    elements.usersList.innerHTML = "<p>Error loading users. Please try again.</p>";
  }
}

function showWarningModal(userId, userName) {
  elements.warningUserName.textContent = userName;
  elements.sendWarningBtn.dataset.userId = userId;
  elements.warningModal.classList.remove("hidden");
  elements.warningMessage.value = "";
}

async function sendWarning() {
  const userId = elements.sendWarningBtn.dataset.userId;
  const message = elements.warningMessage.value.trim();
  
  if (!message) {
    alert("Please enter a warning message");
    return;
  }

  try {
    // Get user data for notification
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      alert("User not found");
      return;
    }
    const userData = userDoc.data();

    // Create warning document in Firestore
    const warningRef = await addDoc(collection(db, "warnings"), {
      userId: userId,
      adminId: currentAdminId,
      message: message,
      createdAt: new Date(),
      read: false,
      adminEmail: elements.adminEmail.textContent
    });

    // Create notification for the user
    await addDoc(collection(db, "notifications"), {
      userId: userId,
      type: "admin_warning",
      title: "Admin Warning",
      message: `You have received a warning from an admin: ${message}`,
      relatedWarningId: warningRef.id,
      timestamp: new Date(),
      read: false
    });

    alert("Warning sent successfully");
    elements.warningModal.classList.add("hidden");
  } catch (error) {
    console.error("Error sending warning:", error);
    alert(`Failed to send warning: ${error.message}`);
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
    loadDashboard(); // Refresh stats
  } catch (error) {
    console.error("Error toggling ban status:", error);
    alert("Failed to update user status.");
  }
}

async function loadQuests(searchTerm = '') {
  try {
    const q = query(collection(db, "quests"), orderBy("createdAt", "desc"));
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
        <p><strong>Status:</strong> <span class="status-badge status-${quest.status || 'active'}">${quest.status || 'active'}</span></p>
        <p><strong>Posted By:</strong> ${posterName}</p>
        <p><strong>Posted On:</strong> ${quest.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}</p>
        <div class="item-actions">
          <button class="btn btn-danger remove-quest-btn" data-quest-id="${questId}">
            <i class="fas fa-trash-alt"></i> Remove Quest
          </button>
        </div>
      `;

      questElement.querySelector('.remove-quest-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        currentQuestId = questId;
        showQuestRemovalConfirmation(quest.title);
      });

      elements.questsList.appendChild(questElement);
    });
  } catch (error) {
    console.error("Error loading quests:", error);
    elements.questsList.innerHTML = "<p>Error loading quests. Please try again.</p>";
  }
}

function showQuestRemovalConfirmation(questTitle) {
  elements.banConfirmDetails.innerHTML = `
    <p>Are you sure you want to remove the quest <strong>"${questTitle}"</strong>?</p>
    <p>This action cannot be undone.</p>
  `;
  elements.confirmBanBtn.textContent = 'Yes, Remove Quest';
  elements.confirmBanBtn.dataset.questId = currentQuestId;
  elements.confirmBanBtn.onclick = confirmQuestRemoval;
  elements.banConfirmModal.classList.remove("hidden");
}

async function confirmQuestRemoval() {
  const questId = elements.confirmBanBtn.dataset.questId;

  try {
    await deleteDoc(doc(db, "quests", questId));
    
    // Also update any reports related to this quest
    const reportsQuery = query(collection(db, "reports"), where("questId", "==", questId));
    const reportsSnapshot = await getDocs(reportsQuery);
    
    const updates = [];
    reportsSnapshot.forEach(docSnap => {
      updates.push(updateDoc(doc(db, "reports", docSnap.id), {
        status: "resolved",
        resolvedBy: currentAdminId,
        resolvedAt: new Date(),
        resolution: "Quest was removed by admin"
      }));
    });
    
    await Promise.all(updates);
    
    alert("Quest removed successfully.");
    elements.banConfirmModal.classList.add("hidden");
    loadQuests();
    loadReports();
    loadDashboard();
  } catch (error) {
    console.error("Error removing quest:", error);
    alert("Failed to remove quest.");
  } finally {
    // Properly reset the button handler and text
    elements.confirmBanBtn.onclick = executeBan;
    elements.confirmBanBtn.textContent = 'Yes, Ban User';
    elements.confirmBanBtn.removeAttribute('data-quest-id');
  }
}

async function openActionModal(reportId = null, reportData = null, questId = null) {
  currentReportId = reportId;
  currentQuestId = questId;
  elements.actionModal.classList.remove("hidden");

  if (reportData) {
    // Fetch reporter name
    let reporterName = "Unknown";
    if (reportData.reportedBy) {
      try {
        const reporterDoc = await getDoc(doc(db, "users", reportData.reportedBy));
        if (reporterDoc.exists()) {
          const reporterData = reporterDoc.data();
          reporterName = `${reporterData.firstName || ''} ${reporterData.lastName || ''}`.trim() || "Unknown";
        }
      } catch (err) {
        console.error("Error fetching reporter:", err);
      }
    }

    // Fetch quest details
    let questTitle = reportData.questTitle || "Untitled Quest";
    let posterName = "Unknown";
    let postedDate = "Unknown date";
    let questUserId = null;
    
    if (reportData.questId) {
      try {
        const questDoc = await getDoc(doc(db, "quests", reportData.questId));
        if (questDoc.exists()) {
          const questData = questDoc.data();
          questTitle = questData.title || "Untitled Quest";
          questUserId = questData.userId;
          
          // Fetch poster's name
          if (questData.userId) {
            const posterDoc = await getDoc(doc(db, "users", questData.userId));
            if (posterDoc.exists()) {
              const posterData = posterDoc.data();
              posterName = `${posterData.firstName || ''} ${posterData.lastName || ''}`.trim() || "Unknown";
            }
          }
          
          // Format the date properly
          if (questData.createdAt) {
            const date = questData.createdAt.toDate ? questData.createdAt.toDate() : new Date(questData.createdAt.seconds * 1000);
            postedDate = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }
      } catch (err) {
        console.error("Error fetching quest:", err);
      }
    }

    // Format report date
    let reportDate = "Unknown date";
    if (reportData.timestamp) {
      const date = reportData.timestamp.toDate ? reportData.timestamp.toDate() : new Date(reportData.timestamp.seconds * 1000);
      reportDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    elements.actionTitle.innerHTML = `<i class="fas fa-flag"></i> Report: ${questTitle}`;
    elements.reportDetailsContainer.innerHTML = `
      <div class="report-detail">
        <strong>Quest:</strong> ${questTitle}
      </div>
      <div class="report-detail">
        <strong>Posted By:</strong> ${posterName} on ${postedDate}
      </div>
      <div class="report-detail">
        <strong>Reason:</strong> ${reportData.reason}
      </div>
      <div class="report-detail">
        <strong>Reported By:</strong> ${reporterName} on ${reportDate}
      </div>
      <div class="report-detail">
        <strong>Status:</strong> <span class="status-badge status-${reportData.status}">${reportData.status}</span>
      </div>
      <div class="report-detail">
        <strong>Details:</strong> ${reportData.details || "No additional details."}
      </div>
      ${reportData.mediaUrl ? `
      <div class="report-detail">
        <strong>Media:</strong> <a href="${reportData.mediaUrl}" target="_blank">View Attachment</a>
      </div>` : ''}
    `;

    // Set up action buttons
    elements.banUserBtn.style.display = "inline-flex";
    elements.dismissReportBtn.style.display = "inline-flex";
    elements.removeQuestBtn.style.display = "inline-flex";
    
    // Store the quest ID for removal if needed
    if (reportData.questId) {
      elements.removeQuestBtn.dataset.questId = reportData.questId;
    }

    // Store the user ID for banning if available
    if (questUserId) {
      elements.banUserBtn.dataset.userId = questUserId;
    }

    // Add authenticate button if status is open
    if (reportData.status === 'open') {
      elements.reportDetailsContainer.innerHTML += `
        <button id="authenticate-report" class="btn btn-primary">
          <i class="fas fa-check-circle"></i> Authenticate Report
        </button>
      `;
      document.getElementById('authenticate-report').addEventListener('click', () => authenticateReport(reportId));
    }
  } else if (questId) {
    // Handle quest removal modal
    try {
      const questDoc = await getDoc(doc(db, "quests", questId));
      if (!questDoc.exists()) {
        alert("Quest not found");
        elements.actionModal.classList.add("hidden");
        return;
      }

      const questData = questDoc.data();
      elements.actionTitle.innerHTML = `<i class="fas fa-map-marked-alt"></i> Remove Quest: ${questData.title}`;
      
      // Fetch poster name
      let posterName = "Unknown";
      if (questData.userId) {
        const posterDoc = await getDoc(doc(db, "users", questData.userId));
        if (posterDoc.exists()) {
          const posterData = posterDoc.data();
          posterName = `${posterData.firstName || ''} ${posterData.lastName || ''}`.trim() || "Unknown";
        }
      }

      elements.reportDetailsContainer.innerHTML = `
        <div class="report-detail">
          <strong>Quest Title:</strong> ${questData.title}
        </div>
        <div class="report-detail">
          <strong>Posted By:</strong> ${posterName}
        </div>
        <div class="report-detail">
          <strong>Description:</strong> ${questData.description || "No description"}
        </div>
        <div class="report-detail">
          <strong>Created On:</strong> ${questData.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}
        </div>
        <div class="report-detail">
          <strong>Status:</strong> <span class="status-badge status-${questData.status || 'active'}">${questData.status || 'active'}</span>
        </div>
      `;

      // Set up action buttons
      elements.banUserBtn.style.display = "none";
      elements.dismissReportBtn.style.display = "none";
      elements.removeQuestBtn.style.display = "inline-flex";
      elements.removeQuestBtn.dataset.questId = questId;
    } catch (error) {
      console.error("Error loading quest details:", error);
      alert("Failed to load quest details");
      elements.actionModal.classList.add("hidden");
    }
  }
}

async function authenticateReport(reportId) {
  try {
    await updateDoc(doc(db, "reports", reportId), {
      status: "authenticated",
      authenticatedBy: currentAdminId,
      authenticatedAt: new Date()
    });
    
    alert("Report authenticated and marked for review");
    elements.actionModal.classList.add("hidden");
    loadReports();
  } catch (error) {
    console.error("Error authenticating report:", error);
    alert("Failed to authenticate report");
  }
}

async function banUser() {
  const userId = elements.banUserBtn.dataset.userId;
  if (!userId) {
    alert("No user to ban for this report.");
    return;
  }

  try {
    // Get user data for confirmation
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      alert("User not found.");
      return;
    }
    const userData = userDoc.data();
    
    showBanConfirmation(userId, userData.banned, `${userData.firstName} ${userData.lastName}`);
    elements.actionModal.classList.add("hidden");
  } catch (error) {
    console.error("Error preparing to ban user:", error);
    alert("Failed to prepare ban action.");
  }
}

async function removeQuest() {
  const questId = elements.removeQuestBtn.dataset.questId;
  if (!questId) {
    alert("No quest selected.");
    return;
  }

  showQuestRemovalConfirmation(questId);
  elements.actionModal.classList.add("hidden");
}

async function dismissReport() {
  if (!currentReportId) return;

  try {
    await updateDoc(doc(db, "reports", currentReportId), {
      status: "dismissed",
      resolvedBy: currentAdminId,
      resolvedAt: new Date(),
      resolution: "Dismissed by admin"
    });

    alert("Report dismissed.");
    elements.actionModal.classList.add("hidden");
    loadReports();
  } catch (error) {
    console.error("Error dismissing report:", error);
    alert("Failed to dismiss report.");
  }
}

// Initialize the admin panel
init();
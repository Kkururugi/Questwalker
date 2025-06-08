// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
  addDoc,
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCbLK26irLxdz03rDCMVHnqHYfDgBjn10g",
  authDomain: "questwalker-5c547.firebaseapp.com",
  projectId: "questwalker-5c547",
  storageBucket: "questwalker-5c547.appspot.com",
  messagingSenderId: "1058097550838",
  appId: "1:1058097550838:web:7bdbb645be374c93e4e3d7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;

// DOM Elements
const elements = {
  usernameDisplay: document.getElementById("username-display"),
  userProfileImg: document.querySelector(".user-img"),
  adminLinkContainer: document.getElementById("admin-link-container"),
  mobileAdminLink: document.getElementById("mobile-admin-link"),
  mobileMenuBtn: document.querySelector(".mobile-menu-btn"),
  mobileSidebar: document.getElementById("mobile-sidebar")
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthState();
});

function setupEventListeners() {
  // Mobile menu toggle
  elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
}

function toggleMobileMenu() {
  elements.mobileSidebar.classList.toggle('hidden');
}

async function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserId = user.uid;
      await loadUserProfile(user.uid);
      loadQuests('open');
      setupFilterButtons();
    } else {
      window.location.href = "index.html";
    }
  });
}

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Update username display in header
      if (elements.usernameDisplay) {
        const displayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";
        elements.usernameDisplay.textContent = displayName;
      }
      
      // Update mobile username display
      const mobileUsernameDisplay = document.getElementById('mobile-username-display');
      if (mobileUsernameDisplay) {
        const mobileDisplayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";
        mobileUsernameDisplay.textContent = mobileDisplayName;
      }

      // Update profile images
      const profileImageUrl = userData.profilePic || "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
      
      if (elements.userProfileImg) {
        elements.userProfileImg.src = profileImageUrl;
      }
      
      const mobileUserImg = document.getElementById('mobile-user-img');
      if (mobileUserImg) {
        mobileUserImg.src = profileImageUrl;
      }

      // Check if user is admin
      if (userData.role === "admin") {
        elements.adminLinkContainer.classList.remove("hidden");
        elements.mobileAdminLink.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Error loading user profile:", error);
  }
}

function setupFilterButtons() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      loadQuests(button.dataset.filter);
    });
  });
}

async function loadQuests(filter) {
  const questsList = document.getElementById('quests-list');
  questsList.innerHTML = '<div class="loading">Loading quests...</div>';

  try {
    if (!currentUserId) throw new Error("Not authenticated");

    let q;
    const baseQuery = collection(db, 'quests');
    
    // Always filter by current user's quests
    q = query(baseQuery, where('userId', '==', currentUserId));
    
    if (filter === 'open') {
      q = query(baseQuery,
        where('userId', '==', currentUserId),
        where('status', '==', 'open'));
    } 
    else if (filter === 'in-progress') {
      q = query(baseQuery,
        where('userId', '==', currentUserId),
        where('status', '==', 'accepted'));
    }
    else if (filter === 'completed') {
      q = query(baseQuery,
        where('userId', '==', currentUserId),
        where('status', '==', 'completed'));
    }
    else if (filter === 'deleted') {
      q = query(baseQuery,
        where('userId', '==', currentUserId),
        where('status', '==', 'deleted'));
    }

    const querySnapshot = await getDocs(q);
    questsList.innerHTML = '';

    if (querySnapshot.empty) {
      questsList.innerHTML = `<div class="empty">No ${filter} quests</div>`;
      return;
    }

    for (const docSnap of querySnapshot.docs) {
      const quest = docSnap.data();
      const questId = docSnap.id;

      // Fetch accepted user's name if applicable
      let acceptedByName = '';
      if (quest.acceptedBy) {
        try {
          const userDoc = await getDoc(doc(db, 'users', quest.acceptedBy));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            acceptedByName = `${userData.firstName} ${userData.lastName}`;
          } else {
            acceptedByName = quest.acceptedBy; // fallback to UID
          }
        } catch (e) {
          acceptedByName = quest.acceptedBy;
        }
      }

      const questElement = document.createElement('div');
      questElement.className = 'quest-card';
      questElement.innerHTML = `
        <h3>${quest.title}</h3>
        <p>${quest.description}</p>
        <p><strong>Status:</strong> ${quest.status}</p>
        <p><strong>Posted:</strong> ${new Date(quest.createdAt?.seconds * 1000).toLocaleDateString()}</p>
        ${acceptedByName ? `<p><strong>Accepted By:</strong> ${acceptedByName}</p>` : ''}
        <div class="quest-actions">
          ${filter !== 'deleted' ? `
            <button class="update-status-btn" data-quest-id="${questId}">
              ${quest.status === 'accepted' ? 'Mark Complete' : 'Update Status'}
            </button>
            <button class="delete-quest-btn" data-quest-id="${questId}">Delete</button>
          ` : ''}
          ${filter === 'deleted' ? `
            <button class="restore-quest-btn" data-quest-id="${questId}">Restore</button>
          ` : ''}
          <button class="view-offers-btn" data-quest-id="${questId}">View Offers</button>
        </div>
      `;

      questElement.querySelector('.update-status-btn')?.addEventListener('click', () => {
        updateQuestStatus(questId, quest.status);
      });

      questElement.querySelector('.delete-quest-btn')?.addEventListener('click', () => {
        deleteQuest(questId);
      });

      questElement.querySelector('.restore-quest-btn')?.addEventListener('click', () => {
        restoreQuest(questId);
      });

      questElement.querySelector('.view-offers-btn')?.addEventListener('click', () => {
        window.location.href = `offers.html?questId=${questId}`;
      });

      questsList.appendChild(questElement);
    }
  } catch (error) {
    console.error('Error loading quests:', error);
    questsList.innerHTML = '<div class="error">Failed to load quests</div>';
  }
}

async function updateQuestStatus(questId, currentStatus) {
  try {
    let newStatus;
    if (currentStatus === 'accepted') {
      newStatus = 'completed';
    } else if (currentStatus === 'open') {
      newStatus = 'accepted';
    } else {
      return;
    }

    const questRef = doc(db, 'quests', questId);
    const questDoc = await getDoc(questRef);
    const questData = questDoc.data();

    const batch = writeBatch(db);
    
    // Update quest status
    batch.update(questRef, {
      status: newStatus,
      updatedAt: new Date()
    });

    // If completing the quest, handle notifications and cleanup
    if (newStatus === 'completed' && questData.acceptedBy) {
      // Notify the accepted user
      batch.set(doc(collection(db, 'notifications')), {
        userId: questData.acceptedBy,
        senderId: currentUserId,
        message: `The quest "${questData.title}" has been marked as completed!`,
        type: 'questCompleted',
        questId: questId,
        timestamp: new Date(),
        read: false
      });

      // Clean up any existing "questAccepted" notifications for this quest
      const acceptedNotificationsQuery = query(
        collection(db, 'notifications'),
        where('questId', '==', questId),
        where('type', '==', 'questAccepted')
      );
      const acceptedNotifications = await getDocs(acceptedNotificationsQuery);
      acceptedNotifications.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    await batch.commit();

    alert('Quest status updated successfully');
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'open';
    loadQuests(activeFilter);

  } catch (error) {
    console.error('Error updating quest status:', error);
    alert('Failed to update quest status: ' + error.message);
  }
}

async function deleteQuest(questId) {
  if (!confirm('Are you sure you want to delete this quest?')) return;

  try {
    await updateDoc(doc(db, 'quests', questId), {
      status: 'deleted',
      deletedAt: new Date()
    });

    alert('Quest deleted successfully');
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'open';
    loadQuests(activeFilter);
  } catch (error) {
    console.error('Error deleting quest:', error);
    alert('Failed to delete quest');
  }
}

async function restoreQuest(questId) {
  try {
    await updateDoc(doc(db, 'quests', questId), {
      status: 'open',
      deletedAt: null
    });

    alert('Quest restored successfully');
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'deleted';
    loadQuests(activeFilter);
  } catch (error) {
    console.error('Error restoring quest:', error);
    alert('Failed to restore quest');
  }
}
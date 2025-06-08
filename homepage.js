// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  query,
  where,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { 
  getAuth, 
  onAuthStateChanged 
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

let currentUserId = null;
let currentUserRole = null;
let questsData = [];
let currentModalQuest = {
  id: null,
  posterId: null,
  title: null
};

// DOM Elements
const elements = {
  searchBar: document.getElementById("search-bar"),
  mobileSearchBar: document.getElementById("mobile-search-bar"),
  questsList: document.getElementById("quests-list"),
  offerModal: document.getElementById("offer-modal"),
  closeOfferModal: document.getElementById("close-offer"),
  sendOfferBtn: document.getElementById("send-offer"),
  offerAmount: document.getElementById("offer-amount"),
  offerText: document.getElementById("offer-text"),
  reportModal: document.getElementById("report-modal"),
  closeReportModal: document.getElementById("close-report"),
  submitReportBtn: document.getElementById("submit-report"),
  reportReason: document.getElementById("report-reason"),
  reportDetails: document.getElementById("report-details"),
  adminLinkContainer: document.getElementById("admin-link-container"),
  mobileAdminLink: document.getElementById("mobile-admin-link"),
  questDetails: document.getElementById("quest-details"),
  defaultView: document.getElementById("default-view"),
  usernameDisplay: document.getElementById("username-display"),
  mobileUsernameDisplay: document.getElementById("mobile-username-display"),
  userProfileImg: document.querySelector(".user-img"),
  mobileUserProfileImg: document.querySelector(".mobile-profile .user-img"),
  mobileMenuBtn: document.querySelector(".mobile-menu-btn"),
  mobileSidebar: document.getElementById("mobile-sidebar"),
  questSidebar: document.getElementById("quest-sidebar"),
  toggleQuestList: document.getElementById("toggle-quest-list"),
  mobileSearchContainer: document.querySelector(".mobile-search-container")
};

// Initialize the app
function init() {
  setupEventListeners();
  checkAuthState();
  loadCategories();
  setupQuestListToggle();
  
  // Ensure correct initial state
  elements.defaultView.classList.remove("hidden");
  elements.questDetails.classList.add("hidden");
}

function setupEventListeners() {
  // Search functionality
  if (elements.searchBar) {
    elements.searchBar.addEventListener("input", searchQuests);
  }
  if (elements.mobileSearchBar) {
    elements.mobileSearchBar.addEventListener("input", searchQuests);
  }

  // Offer modal
  if (elements.closeOfferModal) {
    elements.closeOfferModal.addEventListener("click", () => {
      elements.offerModal.classList.add("hidden");
    });
  }

  if (elements.sendOfferBtn) {
    elements.sendOfferBtn.addEventListener("click", sendOffer);
  }

  // Report modal
  if (elements.closeReportModal) {
    elements.closeReportModal.addEventListener("click", () => {
      elements.reportModal.classList.add("hidden");
    });
  }

  if (elements.submitReportBtn) {
    elements.submitReportBtn.addEventListener("click", submitReport);
  }

  // Mobile menu
  if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener("click", toggleMobileMenu);
  }

  // Event delegation for dynamically created buttons
  document.addEventListener('click', (e) => {
    // Handle make offer button
    if (e.target.classList.contains('make-offer-btn')) {
      e.preventDefault();
      const questId = e.target.dataset.questId;
      const posterId = e.target.dataset.posterId;
      const title = e.target.dataset.title;
      openOfferModal(questId, posterId, title);
      return;
    }
    
    // Handle ask question button
    if (e.target.classList.contains('ask-question-btn')) {
      e.preventDefault();
      const posterId = e.target.dataset.posterId;
      const questId = e.target.dataset.questId;
      const title = e.target.dataset.title;
      askQuestion(posterId, questId, title);
      return;
    }
    
    // Handle report button
    if (e.target.classList.contains('report-btn')) {
      e.preventDefault();
      const questId = e.target.dataset.questId;
      const title = e.target.dataset.title;
      openReportModal(questId, title);
      return;
    }
  });
}

function setupQuestListToggle() {
  if (elements.toggleQuestList && elements.questSidebar) {
    elements.toggleQuestList.addEventListener("click", (e) => {
      e.stopPropagation();
      elements.questSidebar.classList.toggle("expanded");
      const icon = elements.toggleQuestList.querySelector("i");
      if (elements.questSidebar.classList.contains("expanded")) {
        icon.classList.remove("fa-chevron-down");
        icon.classList.add("fa-chevron-up");
        // Close mobile menu if open
        elements.mobileSidebar.classList.add("hidden");
      } else {
        icon.classList.remove("fa-chevron-up");
        icon.classList.add("fa-chevron-down");
      }
    });
    
    // Close expanded sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!elements.questSidebar.contains(e.target) && 
          e.target !== elements.toggleQuestList) {
        elements.questSidebar.classList.remove("expanded");
        const icon = elements.toggleQuestList.querySelector("i");
        icon.classList.remove("fa-chevron-up");
        icon.classList.add("fa-chevron-down");
      }
    });
  }
}

function toggleMobileMenu() {
  elements.mobileSidebar.classList.toggle("hidden");
}

async function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserId = user.uid;
      console.log('User is signed in:', currentUserId);
      await loadUserProfile(user.uid);
      loadQuests();
    } else {
      currentUserId = null;
      currentUserRole = null;
      console.log('User is signed out');
      // Reset UI elements
      if (elements.usernameDisplay) elements.usernameDisplay.textContent = "User";
      if (elements.mobileUsernameDisplay) elements.mobileUsernameDisplay.textContent = "User";
      if (elements.userProfileImg) {
        elements.userProfileImg.src = "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
      }
      if (elements.mobileUserProfileImg) {
        elements.mobileUserProfileImg.src = "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
      }
      elements.adminLinkContainer.classList.add("hidden");
      elements.mobileAdminLink.classList.add("hidden");
    }
  });
}

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Update username display
      const displayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";
      if (elements.usernameDisplay) elements.usernameDisplay.textContent = displayName;
      if (elements.mobileUsernameDisplay) elements.mobileUsernameDisplay.textContent = displayName;
      
      // Update profile image
      const profilePic = userData.profilePic || "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
      if (elements.userProfileImg) elements.userProfileImg.src = profilePic;
      if (elements.mobileUserProfileImg) elements.mobileUserProfileImg.src = profilePic;
      document.querySelectorAll('.user-img-small').forEach(img => img.src = profilePic);

      // Check if user is admin
      if (userData.role === "admin") {
        currentUserRole = "admin";
        elements.adminLinkContainer.classList.remove("hidden");
        elements.mobileAdminLink.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Error loading user profile:", error);
  }
}

async function loadCategories() {
  try {
    const querySnapshot = await getDocs(collection(db, "categories"));
    const tabsContainer = document.querySelector('.category-tabs');
    tabsContainer.innerHTML = '';
    
    // Add "All" tab first
    const allTab = document.createElement('button');
    allTab.className = 'category-tab active';
    allTab.textContent = 'All';
    allTab.dataset.category = 'All';
    allTab.addEventListener('click', () => filterByCategory('All'));
    tabsContainer.appendChild(allTab);

    // Add other categories
    querySnapshot.forEach((doc) => {
      const category = doc.data();
      const tab = document.createElement('button');
      tab.className = 'category-tab';
      tab.textContent = category.name;
      tab.dataset.category = category.name;
      tab.addEventListener('click', () => filterByCategory(category.name));
      tabsContainer.appendChild(tab);
    });
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function loadQuests() {
  try {
    // Get current date
    const now = new Date();
    
    // Modify the query to only get quests that are not accepted or completed
    const q = query(
      collection(db, "quests"),
      where("status", "not-in", ["accepted", "completed", "expired"])
    );
    
    const querySnapshot = await getDocs(q);
    questsData = [];

    const userIds = new Set();
    const updatePromises = [];

    querySnapshot.forEach(docSnap => {
      const questData = { id: docSnap.id, ...docSnap.data() };
      
      // Check expiration first before adding to questsData
      if (questData.completionDate?.seconds) {
        const completionDate = new Date(questData.completionDate.seconds * 1000);
        if (completionDate < now) {
          // Add to update promises to mark as expired
          updatePromises.push(
            runTransaction(db, async (transaction) => {
              // Update quest status to expired
              const questRef = doc(db, "quests", questData.id);
              transaction.update(questRef, {
                status: "expired"
              });
              
              // Create expiration notification
              const notificationRef = doc(collection(db, "notifications"));
              transaction.set(notificationRef, {
                userId: questData.userId,
                message: `Your quest "${questData.title}" has expired as the completion date has passed.`,
                timestamp: new Date(),
                type: 'questExpired',
                questId: questData.id,
                read: false
              });
            })
          );
          return; // Skip adding to questsData
        }
      }
      
      // Only add non-expired quests
      if (questData.userId) {
        userIds.add(questData.userId);
      }
      questsData.push(questData);
    });

    // Wait for all updates to complete before proceeding
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      // After marking quests as expired, reload the quests to ensure consistency
      return loadQuests();
    }

    // Fetch user names
    const userMap = {};
    await Promise.all(Array.from(userIds).map(async userId => {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userMap[userId] = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "Unnamed User";
      } else {
        userMap[userId] = "Unknown";
      }
    }));

    // Attach poster names
    questsData = questsData.map(quest => ({
      ...quest,
      posterName: userMap[quest.userId] || "Unknown"
    }));

    renderQuests(questsData);
  } catch (error) {
    console.error("Error loading quests:", error);
    elements.questsList.innerHTML = "<li>Error loading quests. Please refresh.</li>";
  }
}

function renderQuests(data) {
  const questsList = elements.questsList;
  questsList.innerHTML = '';

  if (data.length === 0) {
    questsList.innerHTML = "<li>No available quests found</li>";
    return;
  }

  data.forEach(quest => {
    const questItem = document.createElement('li');
    questItem.textContent = quest.title;
    questItem.dataset.questId = quest.id;
    
    questItem.addEventListener('click', function() {
      // Remove active class from all items
      document.querySelectorAll('#quests-list li').forEach(item => {
        item.classList.remove('active');
      });
      
      // Add active class to clicked item
      this.classList.add('active');
      
      // Show quest details
      showQuestDetails(quest);
    });

    questsList.appendChild(questItem);
  });
}

function showQuestDetails(quest) {
  // Hide default view and show quest details
  elements.defaultView.classList.add("hidden");
  elements.questDetails.classList.remove("hidden");
  
  // Helper function to format dates from different Firestore formats
  const formatDate = (dateObj) => {
    try {
      // Handle Firestore Timestamp
      if (dateObj && typeof dateObj.toDate === 'function') {
        return dateObj.toDate();
      }
      // Handle seconds/nanoseconds format
      if (dateObj && dateObj.seconds) {
        return new Date(dateObj.seconds * 1000);
      }
      // Handle string or other date formats
      if (dateObj) {
        return new Date(dateObj);
      }
      return null;
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  // Format completion date
  let completionDateStr = "Not specified";
  const completionDate = formatDate(quest.completionDate);
  if (completionDate) {
    completionDateStr = completionDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Format posted date
  let postedDateStr = "N/A";
  const postedDate = formatDate(quest.createdAt);
  if (postedDate) {
    postedDateStr = postedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Create HTML for quest details
  elements.questDetails.innerHTML = `
    <h3>${quest.title}</h3>
    <p><strong>Description:</strong> ${quest.description}</p>
    <p><strong>Location:</strong> ${quest.location}</p>
    <p><strong>Duration:</strong> ${quest.duration} hours</p>
    <p><strong>Completion Date:</strong> ${completionDateStr}</p>
    <p><strong>Posted On:</strong> ${postedDateStr}</p>
    <p><strong>Posted By:</strong> ${quest.posterName}</p>
    <div class="quest-actions">
      <button class="ask-question-btn" data-quest-id="${quest.id}" data-poster-id="${quest.userId}" data-title="${quest.title}">
        <i class="fas fa-question-circle"></i> Ask a Question
      </button>
      <button class="make-offer-btn" data-quest-id="${quest.id}" data-poster-id="${quest.userId}" data-title="${quest.title}">
        <i class="fas fa-hand-holding-usd"></i> Make an Offer
      </button>
      <button class="report-btn" data-quest-id="${quest.id}" data-title="${quest.title}">
        <i class="fas fa-flag"></i> Report
      </button>
    </div>
  `;
}

function filterByCategory(category) {
  // Update active tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });

  if (category === "All") {
    renderQuests(questsData);
  } else {
    const filtered = questsData.filter(q => q.category === category);
    renderQuests(filtered);
  }
}

function searchQuests() {
  const searchTerm = elements.searchBar?.value.toLowerCase() || elements.mobileSearchBar.value.toLowerCase();
  const filtered = questsData.filter(q =>
    q.title.toLowerCase().includes(searchTerm) ||
    q.description.toLowerCase().includes(searchTerm)
  );
  renderQuests(filtered);
}

function openOfferModal(questId, posterId, questTitle) {
  if (!currentUserId) {
    alert('You must be logged in to make an offer.');
    return;
  }
  if (posterId === currentUserId) {
    alert('You cannot make an offer on your own quest.');
    return;
  }

  currentModalQuest = { id: questId, posterId, title: questTitle };
  elements.offerModal.classList.remove("hidden");
  elements.offerAmount.value = "";
  elements.offerText.value = "";
}

async function sendOffer() {
  const amount = elements.offerAmount.value.trim();
  const message = elements.offerText.value.trim();

  if (!amount || isNaN(amount)) {
    alert('Please enter a valid offer amount.');
    return;
  }

  try {
    // Check if quest still exists
    const questDoc = await getDoc(doc(db, "quests", currentModalQuest.id));
    if (!questDoc.exists()) {
      alert('This quest no longer exists.');
      elements.offerModal.classList.add("hidden");
      return;
    }
    
    const questData = questDoc.data();
    if (questData.status === 'accepted') {
      alert('This quest has already been accepted by someone else.');
      elements.offerModal.classList.add("hidden");
      return;
    }

    // Create offer document
    await addDoc(collection(db, 'offers'), {
      questId: currentModalQuest.id,
      offererId: currentUserId,
      receiverId: currentModalQuest.posterId,
      amount: parseFloat(amount),
      message: message || null,
      status: 'pending',
      timestamp: new Date()
    });

    // Create notification
    await addDoc(collection(db, "notifications"), {
      userId: currentModalQuest.posterId,
      message: `You received an offer of $${amount} for your quest "${currentModalQuest.title}"!`,
      timestamp: new Date(),
      type: 'questOffer',
      questId: currentModalQuest.id,
      senderId: currentUserId,
      read: false
    });

    // Create initial message in chat
    const participants = [currentUserId, currentModalQuest.posterId].sort();
    const conversationId = participants.join("_");
    
    // Include the offer message in the chat if provided
    const chatMessage = message 
      ? `I've made an offer of $${amount} for your quest "${currentModalQuest.title}". Message: ${message}`
      : `I've made an offer of $${amount} for your quest "${currentModalQuest.title}"`;
    
    await addDoc(collection(db, "messages"), {
      text: chatMessage,
      senderId: currentUserId,
      receiverId: currentModalQuest.posterId,
      participants,
      conversationId,
      timestamp: new Date()
    });

    elements.offerModal.classList.add("hidden");
    alert('Your offer has been sent!');
    window.location.href = `chat.html?questId=${currentModalQuest.id}&otherUserId=${currentModalQuest.posterId}`;
  } catch (error) {
    console.error('Error sending offer:', error);
    if (error.code === 'permission-denied') {
      alert('You do not have permission to send offers.');
    } else {
      alert('Failed to send offer. Please try again.');
    }
  }
}

function askQuestion(posterId, questId, questTitle) {
  if (!currentUserId) {
    alert('You must be logged in to ask a question.');
    return;
  }

  if (posterId === currentUserId) {
    alert('You cannot ask a question on your own quest.');
    return;
  }

  const question = prompt(`What would you like to ask about "${questTitle}"?`);
  if (!question) return;

  // Redirect to chat with the poster and pre-populate the question
  window.location.href = `chat.html?questId=${questId}&otherUserId=${posterId}&question=${encodeURIComponent(question)}`;
}

function openReportModal(questId, questTitle) {
  if (!currentUserId) {
    alert('You must be logged in to submit a report.');
    return;
  }

  currentModalQuest = { id: questId, title: questTitle };
  elements.reportModal.classList.remove("hidden");
  elements.reportReason.value = "spam"; // Default selection
  elements.reportDetails.value = "";
}

async function submitReport() {
  const reason = elements.reportReason.value.trim();
  const details = elements.reportDetails.value.trim();

  if (!reason) {
    alert("Please enter a report reason.");
    return;
  }

  try {
    await addDoc(collection(db, "reports"), {
      questId: currentModalQuest.id,
      reportedBy: currentUserId,
      reason,
      details,
      createdAt: new Date(),
      status: "open"
    });

    alert("Report submitted. Thank you.");
    elements.reportModal.classList.add("hidden");
  } catch (error) {
    console.error("Error submitting report:", error);
    alert("Failed to submit report.");
  }
}

// Start the app
init();
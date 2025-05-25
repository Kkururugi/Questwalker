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
  hamburger: document.getElementById("hamburger"),
  navMenu: document.getElementById("nav-menu"),
  searchBar: document.getElementById("search-bar"),
  questsList: document.getElementById("quests-list"),
  categoryList: document.getElementById("category-list"),
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
  hideCompletedCheckbox: document.getElementById("hide-completed") // checkbox for hiding completed quests
};

// Initialize the app
function init() {
  setupEventListeners();
  checkAuthState();
  loadCategories();

    if (elements.hideCompletedCheckbox) {
    elements.hideCompletedCheckbox.checked = true;
}
}

function setupEventListeners() {
  // Mobile menu toggle
  if (elements.hamburger && elements.navMenu) {
    elements.hamburger.addEventListener("click", () => {
      elements.navMenu.classList.toggle("active");
      elements.hamburger.classList.toggle("open");
    });
  }

  // Search functionality
  if (elements.searchBar) {
    elements.searchBar.addEventListener("input", searchQuests);
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

  // Hide completed quests checkbox
  if (elements.hideCompletedCheckbox) {
    elements.hideCompletedCheckbox.addEventListener("change", () => {
      renderQuests(questsData); // re-render quests with filter applied
    });
  }
}

async function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserId = user.uid;
      console.log('User is signed in:', currentUserId);

      // Check if user is admin
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        currentUserRole = "admin";
        elements.adminLinkContainer.style.display = "block";
      }

      loadQuests();
    } else {
      currentUserId = null;
      currentUserRole = null;
      console.log('User is signed out');
      // Optionally redirect to login
      // window.location.href = "index.html";
    }
  });
}

async function loadCategories() {
  try {
    const querySnapshot = await getDocs(collection(db, "categories"));
    elements.categoryList.innerHTML = '';

    // Add "All" category option
    const allCategoryOption = document.createElement("li");
    allCategoryOption.textContent = "All";
    allCategoryOption.classList.add("category-item");
    allCategoryOption.addEventListener('click', () => filterByCategory("All"));
    elements.categoryList.appendChild(allCategoryOption);

    // Add other categories
    querySnapshot.forEach((doc) => {
      const category = doc.data();
      const li = document.createElement("li");
      li.textContent = category.name;
      li.classList.add("category-item");
      li.addEventListener('click', () => filterByCategory(category.name));
      elements.categoryList.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function loadQuests() {
  try {
    const querySnapshot = await getDocs(collection(db, "quests"));
    questsData = [];

    const userIds = new Set();

    querySnapshot.forEach(docSnap => {
      const questData = { id: docSnap.id, ...docSnap.data() };
      if (questData.userId) {
        userIds.add(questData.userId);
      }
      questsData.push(questData);
    });

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
    elements.questsList.innerHTML = "<p>Error loading quests. Please refresh.</p>";
  }
}


function renderQuests(data) {
  elements.questsList.innerHTML = '';

  const hideCompleted = elements.hideCompletedCheckbox?.checked;

  data.forEach(quest => {
    // Skip completed quests if checkbox checked
    if (hideCompleted && quest.status === 'completed') {
      return;
    }

    // Skip quests marked as deleted always
    if (quest.status === 'deleted') {
      return;
    }

    // Create quest element
    const questElement = document.createElement("div");
    questElement.classList.add("quest");
    questElement.setAttribute("data-category", quest.category);

    // Format dates
    const completionDate = quest.completionDate?.seconds 
      ? new Date(quest.completionDate.seconds * 1000).toLocaleDateString() 
      : "N/A";
    
    const postedDate = quest.createdAt?.seconds 
      ? new Date(quest.createdAt.seconds * 1000).toLocaleDateString() 
      : "N/A";

    const posterName = quest.posterName || "Unknown";


    questElement.innerHTML = `
      <h3>${quest.title}</h3>
      <p><strong>Description:</strong> ${quest.description}</p>
      <p><strong>Location:</strong> ${quest.location}</p>
      <p><strong>Duration:</strong> ${quest.duration} hours</p>
      <p><strong>Completion Date:</strong> ${completionDate}</p>
      <p><strong>Posted On:</strong> ${postedDate}</p>
      <p><strong>Posted By:</strong> ${posterName}</p>
      <p><strong>Status:</strong> ${quest.status || "open"}</p>
      <div class="quest-actions">
        <button class="ask-question-btn">Ask a Question</button>
        <button class="make-offer-btn">Make an Offer</button>
        
        <button class="report-btn">Report</button>
      </div>
    `;

    addButtonListeners(questElement, quest.id, quest);
    elements.questsList.appendChild(questElement);
  });
}

function addButtonListeners(questElement, questId, quest) {
  // Accept Quest


  // Make Offer
  questElement.querySelector('.make-offer-btn').addEventListener('click', () => {
    openOfferModal(questId, quest.userId, quest.title);
  });

  // Ask Question
  questElement.querySelector('.ask-question-btn').addEventListener('click', () => {
    askQuestion(quest.userId, questId, quest.title);
  });

  // Report
  questElement.querySelector('.report-btn').addEventListener('click', () => {
    openReportModal(questId, quest.title);
  });
}

async function acceptQuest(questId, posterId, questTitle) {
  if (!currentUserId) {
    alert('You must be logged in to accept a quest.');
    return;
  }

  if (posterId === currentUserId) {
    alert('You cannot accept your own quest.');
    return;
  }

  const confirmAccept = confirm(`Are you sure you want to accept the quest "${questTitle}"?`);
  if (!confirmAccept) return;

  try {
    // First check if quest exists and is still available
    const questDoc = await getDoc(doc(db, "quests", questId));
    if (!questDoc.exists()) {
      alert('This quest no longer exists.');
      return;
    }
    
    const questData = questDoc.data();
    if (questData.status && questData.status !== 'open') {
      alert('This quest is no longer available.');
      return;
    }

        // Update quest status
        await updateDoc(questRef, {
            status: 'accepted',
            acceptedBy: currentUserId,
            acceptedAt: new Date()
        });

        // Create notification
        await addDoc(collection(db, "notifications"), {
            userId: posterId,
            message: `Your quest "${questTitle}" was accepted!`,
            timestamp: new Date(),
            type: 'questAccepted',
            questId: questId,
            senderId: currentUserId,
            read: false
        });

        // Create conversation
        const convId = [currentUserId, posterId].sort().join('_');
        const convData = {
            participants: [currentUserId, posterId],
            lastMessage: `Quest "${questTitle}" accepted`,
            lastMessageTimestamp: new Date(),
            questId: questId
        };
        
        await setDoc(
            doc(db, "userConversations", currentUserId, "conversations", convId),
            { ...convData, otherUserId: posterId }
        );
        
        await setDoc(
            doc(db, "userConversations", posterId, "conversations", convId),
            { ...convData, otherUserId: currentUserId }
        );

        alert('Quest accepted! Redirecting to chat...');
        window.location.href = `chat.html?questId=${questId}&otherUserId=${posterId}`;
  } catch (error) {
    console.error('Error accepting quest:', error);
    alert('Failed to accept quest. Please try again.');
  }
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
  currentModalQuest = { id: questId, title: questTitle };
  elements.reportModal.classList.remove("hidden");
  elements.reportReason.value = "";
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

function filterByCategory(category) {
  if (category === "All") {
    renderQuests(questsData);
  } else {
    const filtered = questsData.filter(q => q.category === category);
    renderQuests(filtered);
  }
}

function searchQuests() {
  const searchTerm = elements.searchBar.value.toLowerCase();
  const filtered = questsData.filter(q =>
    q.title.toLowerCase().includes(searchTerm) ||
    q.description.toLowerCase().includes(searchTerm)
  );
  renderQuests(filtered);
}

// Start the app
init();

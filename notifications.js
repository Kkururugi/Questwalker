import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  writeBatch,
  addDoc
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
let currentDropQuestId = null;
let currentNotificationId = null;

// DOM Elements
const elements = {
  notificationsList: document.getElementById('notifications-list'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  dropQuestModal: document.getElementById('dropQuestModal'),
  closeModal: document.querySelector('.close-modal'),
  confirmDrop: document.getElementById('confirmDrop'),
  cancelDrop: document.getElementById('cancelDrop'),
  dropReason: document.getElementById('dropReason')
};

function setupEventListeners() {
  elements.filterButtons?.forEach(button => {
    button.addEventListener('click', () => {
      elements.filterButtons?.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      loadNotifications(button.dataset.filter);
    });
  });

  elements.closeModal?.addEventListener('click', () => {
    elements.dropQuestModal.style.display = 'none';
  });

  elements.cancelDrop?.addEventListener('click', () => {
    elements.dropQuestModal.style.display = 'none';
  });

  elements.confirmDrop?.addEventListener('click', async () => {
    if (elements.dropQuestModal && elements.dropReason) {
      await dropQuest(currentDropQuestId, elements.dropReason.value, currentNotificationId);
      elements.dropQuestModal.style.display = 'none';
      elements.dropReason.value = '';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserId = user.uid;
      await checkAndCleanNotifications();
      loadNotifications();
      setupEventListeners();
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        const adminLinkContainer = document.getElementById('admin-link-container');
        if (adminLinkContainer) {
          adminLinkContainer.style.display = 'block';
        }
      }
    } else {
      window.location.href = "index.html";
    }
  });
});

async function getUserName(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return `${userData.firstName} ${userData.lastName}` || userId;
    }
    return userId;
  } catch (error) {
    console.error('Error getting user name:', error);
    return userId;
  }
}

async function checkAndCleanNotifications() {
  try {
    const q = query(collection(db, 'notifications'), 
        where('userId', '==', currentUserId));
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    let hasChanges = false;

    for (const docSnap of querySnapshot.docs) {
      const notification = docSnap.data();
      
      // Cleanup for quest-related notifications
      if (notification.questId) {
        const questDoc = await getDoc(doc(db, 'quests', notification.questId));
        
        // Delete notification if quest doesn't exist
        if (!questDoc.exists()) {
          batch.delete(docSnap.ref);
          hasChanges = true;
          continue;
        }
        
        const questData = questDoc.data();
        
        // Delete notification if quest was dropped or completed
        if ((notification.type === 'questAccepted' && questData.status === 'open') ||
            (notification.type === 'questAccepted' && questData.status === 'completed')) {
          batch.delete(docSnap.ref);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) await batch.commit();
    return true;
  } catch (error) {
    console.error("Cleanup failed:", error);
    return false;
  }
}

async function createNotificationElement(notification) {
  const notificationElement = document.createElement('div');
  notificationElement.className = `notification ${notification.read ? 'read' : 'unread'}`;
  notificationElement.dataset.notificationId = notification.id;
  
  let questTitle = "Unknown Quest";
  let questStatus = "unknown";
  if (notification.questId) {
    const questDoc = await getDoc(doc(db, 'quests', notification.questId));
    if (!questDoc.exists()) {
      await deleteDoc(doc(db, 'notifications', notification.id));
      return null;
    }
    questTitle = questDoc.data().title;
    questStatus = questDoc.data().status;
  }

  // Get sender's name
  let senderName = "Someone";
  if (notification.senderId) {
    senderName = await getUserName(notification.senderId);
  }

  // SIMPLIFIED AND FIXED MESSAGE HANDLING
  let mainMessage = '';
  let offerMessage = '';

  if (notification.type === 'questOffer') {
    // First try to get from offerData (for direct offers)
    if (notification.offerData) {
      mainMessage = `You received an offer of $${notification.offerData.amount || '0'} for your quest "${questTitle}"!`;
      if (notification.offerData.message) {
        offerMessage = `<div class="offer-message">${notification.offerData.message}</div>`;
      }
    } 
    // Then try to get from notification data (for legacy offers)
    else if (notification.message) {
      mainMessage = notification.message;
      // Extract additional message if present in format "main message - additional message"
      if (notification.message.includes(' - ')) {
        const parts = notification.message.split(' - ');
        mainMessage = parts[0];
        offerMessage = `<div class="offer-message">${parts[1]}</div>`;
      }
    }
  } else {
    // For non-offer notifications
    mainMessage = notification.message || '';
  }

  let content = `
    <div class="notification-content">
      <p><strong>${senderName}:</strong> ${mainMessage}</p>
      ${offerMessage}
      <small>${new Date(notification.timestamp?.seconds * 1000).toLocaleString()}</small>
  `;

  // Rest of the function remains the same...
  let actionButtons = '';
  
  if (notification.type === 'questOffer' && questStatus === 'open') {
    actionButtons = `
      <div class="notification-actions">
        <button class="notification-btn accept-btn" data-notification-id="${notification.id}" data-quest-id="${notification.questId}" data-sender-id="${notification.senderId}">
          Accept Offer
        </button>
        <button class="notification-btn reject-btn" data-notification-id="${notification.id}" data-quest-id="${notification.questId}" data-sender-id="${notification.senderId}">
          Reject
        </button>
      </div>
    `;
  } else if (notification.type === 'questAccepted' && questStatus === 'accepted') {
    actionButtons = `
      <div class="notification-actions">
        <button class="notification-btn drop-btn" data-notification-id="${notification.id}" data-quest-id="${notification.questId}">
          Drop Quest
        </button>
        <button class="notification-btn chat-btn" data-notification-id="${notification.id}" data-quest-id="${notification.questId}" data-sender-id="${notification.senderId}">
          Chat
        </button>
      </div>
    `;
  }

  content += actionButtons + '</div>';
  notificationElement.innerHTML = content;

  notificationElement.addEventListener('click', async (e) => {
    if (!notification.read && !e.target.closest('.notification-btn')) {
      await updateDoc(doc(db, 'notifications', notification.id), {
        read: true
      });
      notificationElement.classList.replace('unread', 'read');
    }
  });

  addNotificationButtonListeners(notificationElement, notification);
  return notificationElement;
}

async function loadNotifications(filter = 'all') {
  const notificationsList = document.getElementById('notifications-list');
  notificationsList.innerHTML = '<div class="loading">Loading notifications...</div>';

  await checkAndCleanNotifications();

  try {
    // Load both notifications and offers
    const [notificationsSnapshot, offersSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, 'notifications'),
        where('userId', '==', currentUserId)
      )),
      getDocs(query(
        collection(db, 'offers'),
        where('receiverId', '==', currentUserId),
        where('status', '==', 'pending')
      ))
    ]);

    notificationsList.innerHTML = '';

    // Process notifications first
    const notificationGroups = {};
    notificationsSnapshot.forEach(doc => {
      const notification = { id: doc.id, ...doc.data() };
      // For offer notifications, use a special key format
      const key = notification.type === 'questOffer' 
        ? `offer_${notification.questId}_${notification.senderId}`
        : `${notification.type}_${notification.questId}_${notification.senderId}`;
      
      if (!notificationGroups[key]) {
        notificationGroups[key] = [];
      }
      notificationGroups[key].push(notification);
    });

    // Process offers - only add if no existing notification exists
offersSnapshot.forEach(doc => {
  const offer = doc.data();
  const key = `offer_${offer.questId}_${offer.offererId}`;
  
  if (!notificationGroups[key]) {
    notificationGroups[key] = [{
      id: doc.id,
      type: 'questOffer',
      questId: offer.questId,
      senderId: offer.offererId,
      timestamp: offer.timestamp,
      read: false,
      offerData: {  // This is critical
        amount: offer.amount,
        message: offer.message // Ensure this matches your Firestore field name exactly
      }
    }];
  }
});

    // Process and sort notifications
    const processedNotifications = [];
    for (const groupKey in notificationGroups) {
      const group = notificationGroups[groupKey];
      group.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
      processedNotifications.push(group[0]);
    }

    processedNotifications.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);

    // Render all items
    for (const notification of processedNotifications) {
      const notificationElement = await createNotificationElement(notification);
      if (notificationElement) {
        notificationsList.appendChild(notificationElement);
      }
    }

    if (processedNotifications.length === 0) {
      notificationsList.innerHTML = '<div class="empty">No notifications found</div>';
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = '<div class="error">Failed to load notifications</div>';
  }
}

function addNotificationButtonListeners(element, notification) {
  element.querySelector('.accept-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const questId = e.target.dataset.questId;
    const senderId = e.target.dataset.senderId;
    const notificationId = e.target.dataset.notificationId;
    
    try {
      // Get all offers from this user for this quest
      const offersQuery = query(
        collection(db, 'offers'),
        where('questId', '==', questId),
        where('offererId', '==', senderId)
      );
      
      const offersSnapshot = await getDocs(offersQuery);
      if (offersSnapshot.empty) {
        alert('Offer no longer available');
        return;
      }
      
      const batch = writeBatch(db);
      
      // Update quest status
      batch.update(doc(db, 'quests', questId), {
        status: 'accepted',
        acceptedBy: senderId,
        acceptedAt: new Date()
      });
      
      // Mark all offers from this user as accepted
      offersSnapshot.forEach(offerDoc => {
        batch.update(doc(db, 'offers', offerDoc.id), {
          status: 'accepted',
          updatedAt: new Date()
        });
      });
      
      // Reject all other offers for this quest
      const otherOffersQuery = query(
        collection(db, 'offers'),
        where('questId', '==', questId),
        where('offererId', '!=', senderId)
      );
      const otherOffers = await getDocs(otherOffersQuery);
      otherOffers.forEach(doc => {
        batch.update(doc.ref, {
          status: 'rejected',
          updatedAt: new Date()
        });
      });
      
      // Notify offerer
      const questDoc = await getDoc(doc(db, 'quests', questId));
      const questTitle = questDoc.exists() ? questDoc.data().title : 'the quest';
      
      batch.set(doc(collection(db, 'notifications')), {
        userId: senderId,
        message: `Your offer for "${questTitle}" was accepted!`,
        type: 'questAccepted',
        questId: questId,
        senderId: currentUserId,
        timestamp: new Date(),
        read: false
      });
      
      // Delete all offer notifications for this quest from this sender
      const offerNotificationsQuery = query(
        collection(db, 'notifications'),
        where('questId', '==', questId),
        where('senderId', '==', senderId),
        where('type', '==', 'questOffer')
      );
      const offerNotifications = await getDocs(offerNotificationsQuery);
      offerNotifications.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert('Offer accepted successfully!');
      loadNotifications();
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert('Failed to accept offer: ' + error.message);
    }
  });

  element.querySelector('.reject-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const questId = e.target.dataset.questId;
    const senderId = e.target.dataset.senderId;
    const notificationId = e.target.dataset.notificationId;
    
    if (!confirm('Are you sure you want to reject this offer?')) return;
    
    try {
      const batch = writeBatch(db);
      
      // Find and update the offer
      const offersQuery = query(
        collection(db, 'offers'),
        where('questId', '==', questId),
        where('offererId', '==', senderId)
      );
      const offersSnapshot = await getDocs(offersQuery);
      if (!offersSnapshot.empty) {
        batch.update(doc(db, 'offers', offersSnapshot.docs[0].id), {
          status: 'rejected',
          updatedAt: new Date()
        });
      }
      
      // Notify offerer
      const questDoc = await getDoc(doc(db, 'quests', questId));
      const questTitle = questDoc.exists() ? questDoc.data().title : 'the quest';
      
      batch.set(doc(collection(db, 'notifications')), {
        userId: senderId,
        message: `Your offer for "${questTitle}" was rejected.`,
        type: 'offerRejected',
        questId: questId,
        senderId: currentUserId,
        timestamp: new Date(),
        read: false
      });
      
      // Delete the notification
      batch.delete(doc(db, 'notifications', notificationId));
      
      await batch.commit();
      alert('Offer rejected');
      loadNotifications();
    } catch (error) {
      console.error('Error rejecting offer:', error);
      alert('Failed to reject offer');
    }
  });

  element.querySelector('.drop-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    currentDropQuestId = e.target.dataset.questId;
    currentNotificationId = e.target.dataset.notificationId;
    elements.dropQuestModal.style.display = 'block';
  });
}

async function dropQuest(questId, reason, notificationId = null) {
  if (!reason) {
    alert('Please provide a reason for dropping the quest');
    return;
  }

  try {
    const questRef = doc(db, 'quests', questId);
    const questDoc = await getDoc(questRef);

    if (!questDoc.exists()) {
      alert('Quest no longer exists');
      return;
    }

    const questData = questDoc.data();
    if (currentUserId !== questData.acceptedBy) {
      alert("Only the accepted user can drop the quest.");
      return;
    }

    const batch = writeBatch(db);
    
    // Update quest
    batch.update(questRef, {
      status: 'open',
      acceptedBy: null,
      acceptedAt: null,
      droppedAt: new Date(),
      dropReason: reason
    });

    // Mark notification as read if exists
    if (notificationId) {
      batch.update(doc(db, 'notifications', notificationId), {
        read: true,
        resolved: true
      });
    }

    // Notify quest owner
    batch.set(doc(collection(db, 'notifications')), {
      userId: questData.userId,
      senderId: currentUserId,
      message: `Your quest "${questData.title}" was dropped. Reason: ${reason}`,
      type: 'questDropped',
      questId: questId,
      timestamp: new Date(),
      read: false
    });

    await batch.commit();
    alert('Quest dropped successfully!');
    loadNotifications();
  } catch (error) {
    console.error('Error dropping quest:', error);
    alert(`Failed to drop quest: ${error.message}`);
  }
}
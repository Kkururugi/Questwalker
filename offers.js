import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,         // ✅ ADDED
  doc,
  updateDoc,
  addDoc          // ✅ ADDED
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
let currentQuestId = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentQuestId = urlParams.get('questId');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      loadOffers();
      checkAdmin(user.uid); // also check if admin
    } else {
      window.location.href = "index.html";
    }
  });
});

async function checkAdmin(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists() && userDoc.data().role === "admin") {
      document.getElementById('admin-link-container').style.display = 'block';
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
  }
}

async function loadOffers() {
  const offersList = document.getElementById('offers-list');
  offersList.innerHTML = '<div class="loading">Loading offers...</div>';

  try {
    let q;
    if (currentQuestId) {
      q = query(collection(db, 'offers'), where('questId', '==', currentQuestId));
    } else {
      q = query(collection(db, 'offers'), where('receiverId', '==', currentUserId));
    }

    const querySnapshot = await getDocs(q);
    offersList.innerHTML = '';

    if (querySnapshot.empty) {
      offersList.innerHTML = '<div class="empty">No offers found</div>';
      return;
    }

    const offers = [];
    querySnapshot.forEach(doc => {
      offers.push({ id: doc.id, ...doc.data() });
    });
    offers.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);

    for (const offer of offers) {
      // Get offerer's name
      let offererName = "Unknown";
      try {
        const offererDoc = await getDoc(doc(db, 'users', offer.offererId));
        if (offererDoc.exists()) {
          const data = offererDoc.data();
          offererName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        }
      } catch (error) {
        console.error('Error fetching offerer info:', error);
      }

      // Get quest title
      let questTitle = "Unknown Quest";
      try {
        const questDoc = await getDoc(doc(db, 'quests', offer.questId));
        if (questDoc.exists()) {
          questTitle = questDoc.data().title || "Untitled Quest";
        }
      } catch (error) {
        console.error('Error fetching quest info:', error);
      }

      const offerElement = document.createElement('div');
      offerElement.className = 'offer-card';
      offerElement.innerHTML = `
        <h3>${questTitle}</h3>
        <p><strong>From:</strong> ${offererName}</p>
        <p><strong>Amount:</strong> $${offer.amount}</p>
        ${offer.message ? `<p><strong>Message:</strong> ${offer.message}</p>` : ''}
        <p><strong>Status:</strong> ${offer.status}</p>
        <p><strong>Date:</strong> ${new Date(offer.timestamp?.seconds * 1000).toLocaleString()}</p>
        <div class="offer-actions">
          ${offer.status === 'pending' && offer.receiverId === currentUserId ? `
            <button class="accept-offer-btn" data-offer-id="${offer.id}">Accept</button>
            <button class="reject-offer-btn" data-offer-id="${offer.id}">Reject</button>
          ` : ''}
          <button class="chat-btn" data-user-id="${offer.offererId}" data-quest-id="${offer.questId}">Chat</button>
        </div>
      `;

      // Add event listeners
      offerElement.querySelector('.accept-offer-btn')?.addEventListener('click', () => {
        acceptOffer(offer.id, offer.questId, offer.offererId);
      });

      offerElement.querySelector('.reject-offer-btn')?.addEventListener('click', () => {
        rejectOffer(offer.id);
      });

      offerElement.querySelector('.chat-btn')?.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        const questId = e.target.dataset.questId;
        window.location.href = `chat.html?questId=${questId}&otherUserId=${userId}`;
      });

      offersList.appendChild(offerElement);
    }
  } catch (error) {
    console.error('Error loading offers:', error);
    offersList.innerHTML = '<div class="error">Failed to load offers</div>';
  }
}

async function acceptOffer(offerId, questId, offererId) {
  if (!confirm('Are you sure you want to accept this offer?')) return;

  try {
    await updateDoc(doc(db, 'offers', offerId), {
      status: 'accepted',
      updatedAt: new Date()
    });

    await updateDoc(doc(db, 'quests', questId), {
      status: 'accepted',
      acceptedBy: offererId,
      acceptedAt: new Date()
    });

    await addDoc(collection(db, 'notifications'), {
      userId: offererId,
      message: `Your offer for a quest has been accepted!`,
      timestamp: new Date(),
      type: 'offerAccepted',
      questId: questId,
      senderId: currentUserId,
      read: false
    });

    alert('Offer accepted successfully!');
    loadOffers();
  } catch (error) {
    console.error('Error accepting offer:', error);
    alert('Failed to accept offer');
  }
}

async function rejectOffer(offerId) {
  if (!confirm('Are you sure you want to reject this offer?')) return;

  try {
    await updateDoc(doc(db, 'offers', offerId), {
      status: 'rejected',
      updatedAt: new Date()
    });

    alert('Offer rejected successfully');
    loadOffers();
  } catch (error) {
    console.error('Error rejecting offer:', error);
    alert('Failed to reject offer');
  }
}

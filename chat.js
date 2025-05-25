// Import Firebase SDKs
// Update your imports at the top of chat.js
import {
    getFirestore, collection, query, orderBy, addDoc, getDocs, onSnapshot,
    doc, where, getDoc, setDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";

// Firebase Config
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
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let selectedUserId = null;
let selectedUserName = "";
let currentChatUnsubscribe = null;
let pendingImage = null;

const userNameCache = new Map();


const elements = {
    hamburger: document.getElementById("hamburger"),
    navMenu: document.getElementById("nav-menu"),
    userList: document.getElementById("userList"),
    chatHeader: document.getElementById("chatHeader"),
    messages: document.getElementById("messages"),
    sendBtn: document.getElementById("sendBtn"),
    messageInput: document.getElementById("messageInput"),
    searchInput: document.getElementById("searchInput"),
    chatImageInput: document.getElementById("chatImageInput"),
    chatImageButton: document.getElementById("chatImageButton"),
    imagePreview: document.getElementById("imagePreview")
};

// Event listeners
function initEventListeners() {
    // Check if elements exist before adding listeners
    if (!elements) {
        console.error("Elements object is not defined");
        return;
    }

    // Hamburger menu
    if (elements.hamburger && elements.navMenu) {
        elements.hamburger.addEventListener("click", () => {
            elements.navMenu.classList.toggle("active");
            elements.hamburger.classList.toggle("open");
        });
    }

    // Message sending
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener("click", sendMessage);
    }

    if (elements.messageInput) {
        elements.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    // User search
    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", debounce(searchUsers, 300));
    }

    // Image upload
    if (elements.chatImageButton && elements.chatImageInput) {
        elements.chatImageButton.addEventListener("click", () => {
            elements.chatImageInput.click();
        });

        elements.chatImageInput.addEventListener("change", handleImageUpload);
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
        pendingImage = reader.result;
        elements.imagePreview.innerHTML = `
            <div class="preview-wrapper">
                <img src="${pendingImage}" class="chat-image-preview">
                <button id="removeImageBtn" class="remove-image-btn">✖</button>
            </div>
        `;
        elements.imagePreview.classList.remove("hidden");

        document.getElementById("removeImageBtn").addEventListener("click", () => {
            pendingImage = null;
            elements.imagePreview.classList.add("hidden");
            elements.imagePreview.innerHTML = "";
            elements.chatImageInput.value = null;
        });
    };
    reader.readAsDataURL(file);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function toggleChatInput(show) {
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) {
        chatInput.style.display = show ? 'flex' : 'none';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = {
            uid: user.uid,
            displayName: user.displayName || "User",
            email: user.email
        };
        
        // Initialize with chat input hidden
        toggleChatInput(false);
        
        await loadRecentConversations();
        initEventListeners();

        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('otherUserId');
        const question = urlParams.get('question');

        if (chatId) {
            try {
                const userDoc = await getDoc(doc(db, "users", chatId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    openChat(chatId, `${userData.firstName} ${userData.lastName}`);
                    if (question) {
                        setTimeout(() => {
                            elements.messageInput.value = decodeURIComponent(question);
                            sendMessage();
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error("Error opening chat:", error);
            }
        }
    } else {
        window.location.href = "index.html";
    }
});




// Load recent conversations
async function loadRecentConversations() {
    if (!elements.userList || !currentUser?.uid) return;

    elements.userList.innerHTML = "<div class='loading'>Loading chats...</div>";

    try {
        const userConversationsRef = collection(db, "userConversations", currentUser.uid, "conversations");
        const conversationsSnapshot = await getDocs(userConversationsRef);

        if (conversationsSnapshot.empty) {
            elements.userList.innerHTML = "<div class='info'>No recent chats. Search for a user to start one.</div>";
            return;
        }

        const conversations = [];

        for (const docSnap of conversationsSnapshot.docs) {
            const data = docSnap.data();
            let otherUserId = data.otherUserId;
            let name = data.otherUserName;

            // If name is missing or looks invalid, fetch it from users collection
            if (!name || name === "User" || name === "Unknown" || name === "admin") {
                try {
                    const userDoc = await getDoc(doc(db, "users", otherUserId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";

                        // Save fixed name back to Firestore for future use
                        await setDoc(doc(db, "userConversations", currentUser.uid, "conversations", docSnap.id), {
                            otherUserName: name
                        }, { merge: true });
                    } else {
                        name = "User";
                    }
                } catch (error) {
                    console.error("Error fetching user name:", error);
                    name = "User";
                }
            }

            conversations.push({
                id: otherUserId,
                name,
                lastMessage: data.lastMessage || "",
                timestamp: data.lastMessageTimestamp?.toDate() || new Date(0)
            });
        }

        // Sort by timestamp
        conversations.sort((a, b) => b.timestamp - a.timestamp);
        renderUserList(conversations);
    } catch (error) {
        console.error("Error loading conversations:", error);
        elements.userList.innerHTML = "<div class='error'>Failed to load chats. Please refresh.</div>";
    }
}


// Render user list
function renderUserList(users) {
    if (!elements.userList) return;
    
    elements.userList.innerHTML = "";
    if (!users.length) {
        elements.userList.innerHTML = "<div class='empty-state'>No users found</div>";
        return;
    }

    users.forEach(user => {
        const userDiv = document.createElement("div");
        userDiv.className = "user-item";
        userDiv.innerHTML = `
            <div class="user-name">${user.name}</div>
            <div class="last-message">${user.lastMessage || ""}</div>
        `;
        userDiv.addEventListener("click", () => openChat(user.id, user.name));
        elements.userList.appendChild(userDiv);
    });
}

// Open chat with selected user
async function openChat(partnerId, partnerName = "") {
    if (!currentUser?.uid) {
        console.error("Cannot open chat - user not authenticated");
        return;
    }

    selectedUserId = partnerId;

    toggleChatInput(true);

    // Always fetch proper full name from Firestore
    try {
        const userDoc = await getDoc(doc(db, "users", partnerId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            partnerName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";
        } else {
            partnerName = "User";
        }
    } catch (error) {
        console.error("Error fetching user name:", error);
        partnerName = "User";
    }

    selectedUserName = partnerName;

    // Show user name in chat header
    elements.chatHeader.innerHTML = `Chat with <a href="profile.html?id=${partnerId}" class="chat-username-link">${partnerName}</a>`;
    elements.messages.innerHTML = "<div class='loading'>Loading messages...</div>";

    // Clean up previous listener
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
        currentChatUnsubscribe = null;
    }

    // Save correct name in conversation metadata
    await updateUserConversation(partnerId, partnerName);
    listenForMessages();
}




// Update conversation metadata
async function updateUserConversation(partnerId, partnerName) {
    if (!currentUser?.uid) {
        console.error("Cannot update conversation - user not authenticated");
        return;
    }

    try {
        const convId = [currentUser.uid, partnerId].sort().join('_');
        const convRef = doc(db, "userConversations", currentUser.uid, "conversations", convId);
        
        await setDoc(convRef, {
            otherUserId: partnerId,
            otherUserName: partnerName,
            updatedAt: new Date()
        }, { merge: true });
    } catch (error) {
        console.error("Conversation update failed:", error);
    }
}

// Listen for messages in current chat
async function listenForMessages() {
    if (!selectedUserId || !currentUser?.uid) {
        toggleChatInput(false);
        return;
    }

    const conversationId = [currentUser.uid, selectedUserId].sort().join('_');
    const q = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        orderBy("timestamp", "asc")
    );

    // Clear previous messages and show loading
    elements.messages.innerHTML = "<div class='loading'>Loading messages...</div>";
    if (currentChatUnsubscribe) currentChatUnsubscribe();

    try {
        // First load all existing messages
        const snapshot = await getDocs(q);
        elements.messages.innerHTML = ""; // Clear loading message

        if (snapshot.empty) {
            elements.messages.innerHTML = "<div class='empty-state'>No messages yet</div>";
            toggleChatInput(true);
            return;
        }

        // Process all messages in order
        const messages = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Display all messages in order
        messages.sort((a, b) => {
            const timeA = a.timestamp?.toDate().getTime() || 0;
            const timeB = b.timestamp?.toDate().getTime() || 0;
            return timeA - timeB;
        }).forEach(msg => displayMessage(msg, msg.id));

        // Scroll to bottom after initial load
        setTimeout(() => {
            elements.messages.scrollTop = elements.messages.scrollHeight;
        }, 100);

        // Then set up real-time listener
        currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    displayMessage(change.doc.data(), change.doc.id);
                    // Only scroll if new message is from current chat
                    if (change.doc.data().senderId === selectedUserId || 
                        change.doc.data().senderId === currentUser.uid) {
                        setTimeout(() => {
                            elements.messages.scrollTop = elements.messages.scrollHeight;
                        }, 50);
                    }
                }
            });
        });

        toggleChatInput(true);
    } catch (error) {
        console.error("Error loading messages:", error);
        elements.messages.innerHTML = "<div class='error'>Failed to load messages</div>";
    }
}

// Optimized displayMessage function
async function displayMessage(msg, id = null) {
    if (!elements.messages) return;

    // Check if message already exists
    if (id && document.getElementById(`message-${id}`)) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${msg.senderId === currentUser.uid ? 'me' : 'them'}`;
    if (id) messageDiv.id = `message-${id}`;

    // Get sender name (with caching)
    let senderName = "User";
    if (msg.senderId === currentUser.uid) {
        senderName = "You";
    } else {
        if (userNameCache.has(msg.senderId)) {
            senderName = userNameCache.get(msg.senderId);
        } else {
            try {
                const userDoc = await getDoc(doc(db, "users", msg.senderId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    senderName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                    userNameCache.set(msg.senderId, senderName);
                }
            } catch (error) {
                console.error("Error fetching user:", error);
            }
        }
    }

    // Format timestamp
    const time = msg.timestamp?.toDate().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    }) || '';

    // Create message content
    const content = msg.image 
        ? `<img src="${msg.image}" class="chat-image" alt="Sent image">`
        : msg.text || "";

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender">${senderName}</span>
            <span class="time">${time}</span>
        </div>
        <div class="message-content">${content}</div>
    `;

    elements.messages.appendChild(messageDiv);
}



// Send a message

async function sendMessage() {
    const text = elements.messageInput.value.trim();

    if (!text && !pendingImage) {
        console.error("Nothing to send.");
        return;
    }

    if (!selectedUserId || !currentUser?.uid) {
        console.error("Cannot send message - missing user info");
        return;
    }

    try {
        const participants = [currentUser.uid, selectedUserId].sort();
        const conversationId = participants.join("_");
        const timestamp = new Date();

        // Get the current user's full name
        let currentUserName = "User";
        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                currentUserName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || "User";
            }
        } catch (e) {
            console.warn("Could not fetch current user's full name:", e);
        }

        // Create message data
        const messageData = {
            senderId: currentUser.uid,
            receiverId: selectedUserId,
            participants,
            conversationId,
            timestamp
        };

        if (text) {
            messageData.text = text;
        }

        if (pendingImage) {
            messageData.image = pendingImage;
        }

        // Save message
        await addDoc(collection(db, "messages"), messageData);

        // Update conversation metadata for both users
        const lastMessageContent = pendingImage ? "[Image]" : text;
        
        await setDoc(doc(db, "userConversations", currentUser.uid, "conversations", conversationId), {
            otherUserId: selectedUserId,
            otherUserName: selectedUserName,
            lastMessage: lastMessageContent,
            lastMessageTimestamp: timestamp,
            updatedAt: timestamp,
            participants
        }, { merge: true });

        await setDoc(doc(db, "userConversations", selectedUserId, "conversations", conversationId), {
            otherUserId: currentUser.uid,
            otherUserName: currentUserName,
            lastMessage: lastMessageContent,
            lastMessageTimestamp: timestamp,
            updatedAt: timestamp,
            participants
        }, { merge: true });

        // Clear inputs
        elements.messageInput.value = "";
        pendingImage = null;
        elements.imagePreview.classList.add("hidden");
        elements.imagePreview.innerHTML = "";
        elements.chatImageInput.value = null;

    } catch (error) {
        console.error("Error sending message:", error);
        alert(`Failed to send message: ${error.message}`);
    }
}


// Search users
async function searchUsers(event) {
    const searchQuery = event.target.value.toLowerCase().trim();

    if (!elements.userList || !currentUser?.uid) return;

    if (!searchQuery) {
        await loadRecentConversations();
        return;
    }

    elements.userList.innerHTML = "<div class='loading'>Searching users...</div>";

    try {
        // Fetch all users and conversations
        const [usersSnapshot, conversationsSnapshot] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "userConversations", currentUser.uid, "conversations"))
        ]);

        // Prepare maps for lookup
        const conversationUsersMap = new Map();
        conversationsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data?.otherUserId) {
                conversationUsersMap.set(data.otherUserId, {
                    id: data.otherUserId,
                    name: data.otherUserName || "Unknown",
                    lastMessage: data.lastMessage || "",
                    timestamp: data.lastMessageTimestamp?.toDate() || new Date(0)
                });
            }
        });

        // Filter users by search query
        const filteredUsers = [];
        usersSnapshot.forEach(docSnap => {
            if (docSnap.id !== currentUser.uid) {
                const user = docSnap.data();
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                if (fullName.includes(searchQuery)) {
                    // Skip duplicates
                    if (!conversationUsersMap.has(docSnap.id)) {
                        filteredUsers.push({
                            id: docSnap.id,
                            name: `${user.firstName} ${user.lastName}`,
                            lastMessage: "",
                            timestamp: new Date(0)
                        });
                    }
                }
            }
        });

        // Combine results
        const combinedUsers = [
            ...conversationUsersMap.values(),
            ...filteredUsers
        ].sort((a, b) => b.timestamp - a.timestamp);

        renderUserList(combinedUsers);
    } catch (error) {
        console.error("Error searching users:", error);
        elements.userList.innerHTML = "<div class='error'>Search failed. Please try again.</div>";
    }
}
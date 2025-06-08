// Import Firebase SDKs
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

// DOM Elements
const elements = {
    userList: document.getElementById("userList"),
    chatHeader: document.getElementById("chatHeader"),
    messages: document.getElementById("messages"),
    sendBtn: document.getElementById("sendBtn"),
    messageInput: document.getElementById("messageInput"),
    searchInput: document.getElementById("searchInput"),
    chatImageInput: document.getElementById("chatImageInput"),
    chatImageButton: document.getElementById("chatImageButton"),
    imagePreview: document.getElementById("imagePreview"),
    usernameDisplay: document.getElementById("username-display"),
    userProfileImg: document.querySelector(".user-img"),
    adminLinkContainer: document.getElementById("admin-link-container"),
    mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
    sidebarNav: document.querySelector(".sidebar-nav"),
    backToChatsBtn: document.getElementById("back-to-chats"),
    mobileChatHeader: document.querySelector(".mobile-chat-header"),
    mainContent: document.querySelector(".main-content"),
    questSidebar: document.querySelector(".quest-sidebar")
};

// Initialize user profile and admin controls
function initUserControls(user) {
    // Set username
    if (elements.usernameDisplay) {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || "User";
        elements.usernameDisplay.textContent = displayName;
    }
    
    // Set profile image
    if (elements.userProfileImg) {
        elements.userProfileImg.src = user.profilePic || 
            "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
    }
    
    // Show admin link if user is admin
    if (elements.adminLinkContainer) {
        if (user.role === "admin") {
            elements.adminLinkContainer.classList.remove("hidden");
        } else {
            elements.adminLinkContainer.classList.add("hidden");
        }
    }
}

// Mobile menu toggle
function setupMobileMenu() {
    if (elements.mobileMenuToggle && elements.sidebarNav) {
        elements.mobileMenuToggle.addEventListener("click", () => {
            elements.sidebarNav.classList.toggle("mobile-visible");
        });
    }
}

// Mobile view management
function showChatView() {
    elements.mainContent.classList.add("active");
    elements.questSidebar.classList.remove("active");
    elements.mobileChatHeader.classList.remove("hidden");
    toggleChatInput(true);
}

function showChatList() {
    elements.mainContent.classList.remove("active");
    elements.questSidebar.classList.add("active");
    elements.mobileChatHeader.classList.add("hidden");
    toggleChatInput(false);
}

// Event listeners
function initEventListeners() {
    // Message sending
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener("click", sendMessage);
    }

    if (elements.messageInput) {
        elements.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    // Back button click on mobile
    if (elements.backToChatsBtn) {
        elements.backToChatsBtn.addEventListener("click", showChatList);
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
    
    setupMobileMenu();
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
}

function handleResize() {
    if (window.innerWidth > 768) {
        // Desktop view - show both sidebar and main content
        elements.mainContent.classList.remove("active");
        elements.questSidebar.classList.remove("active");
        elements.mobileChatHeader.classList.add("hidden");
        document.querySelector('.sidebar-nav').classList.remove('mobile-visible');
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

function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        }).replace(/,/g, '');
    }
}

function addDateSeparator(date) {
    const dateLabel = formatDate(date);
    
    const dateSeparator = document.createElement('div');
    dateSeparator.className = 'date-separator';
    dateSeparator.innerHTML = `<span class="date-label">${dateLabel}</span>`;
    elements.messages.appendChild(dateSeparator);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = {
            uid: user.uid,
            displayName: user.displayName || "User",
            email: user.email
        };
        
        // Fetch additional user data
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            initUserControls(userData);
        }
        
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
                    
                    // On mobile, show chat list first if coming from a link
                    if (window.innerWidth <= 768) {
                        showChatList();
                    }
                }
            } catch (error) {
                console.error("Error opening chat:", error);
            }
        } else if (window.innerWidth <= 768) {
            // On mobile, default to showing chat list
            showChatList();
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
        
        // Add pointer cursor style
        userDiv.style.cursor = "pointer";
        
        // Use event delegation for better performance
        userDiv.onclick = () => {
            openChat(user.id, user.name);
            if (window.innerWidth <= 768) {
                showChatView();
            }
        };
        
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

    // Update mobile header
    const mobileHeaderText = document.getElementById("mobileChatHeader");
    if (mobileHeaderText) {
        mobileHeaderText.textContent = `Chat with ${partnerName}`;
    }
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

    // Clean up previous listener
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
        currentChatUnsubscribe = null;
    }

    // Show loading state
    elements.messages.innerHTML = "<div class='loading'>Loading messages...</div>";

    // Set up real-time listener
    currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
        elements.messages.innerHTML = ""; // Clear messages

        if (snapshot.empty) {
            elements.messages.innerHTML = "<div class='empty-state'>No messages yet. Start the conversation!</div>";
            toggleChatInput(true);
            return;
        }

        // Process and sort messages
        const messages = [];
        snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
        messages.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));

        let previousDate = null;
        messages.forEach((msg, index) => {
            const msgDate = msg.timestamp?.toDate() || new Date();
            const currentDate = msgDate.toDateString();

            // Add separator before the first message or when date changes
            if (index === 0 || currentDate !== previousDate) {
                addDateSeparator(msgDate);
            }

            displayMessage(msg, msg.id);
            previousDate = currentDate;
        });

        // Scroll to bottom after rendering
        setTimeout(() => {
            elements.messages.scrollTop = elements.messages.scrollHeight;
        }, 100);
    });
}



// Display a message
async function displayMessage(msg, id = null) {
    if (!elements.messages) return;
    if (id && document.getElementById(`message-${id}`)) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${msg.senderId === currentUser.uid ? 'me' : 'them'}`;
    if (id) messageDiv.id = `message-${id}`;
    messageDiv.setAttribute('data-date', msg.timestamp?.toDate().toDateString() || new Date().toDateString());

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
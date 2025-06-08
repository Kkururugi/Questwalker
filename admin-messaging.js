import { collection, addDoc, query, orderBy, onSnapshot, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { db } from "./firebase-config.js"; // Assuming firebase-config.js exports your db

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("admin-message");
const sendButton = document.getElementById("send-message-btn");
const userSelect = document.getElementById("user-select");
const adminId = "admin"; // Replace with actual admin UID if using authentication

// Load users into dropdown for selection
async function loadUsers() {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach(doc => {
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = `${doc.data().firstName} ${doc.data().lastName}`;
        userSelect.appendChild(option);
    });
}

loadUsers();

// Load messages when a user is selected
userSelect.addEventListener("change", () => {
    const userId = userSelect.value;
    if (!userId) return;

    const q = query(
        collection(db, "messages"),
        where("receiverId", "in", [userId, adminId]),
        where("senderId", "in", [userId, adminId]),
        orderBy("timestamp")
    );

    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = "";
        snapshot.forEach(doc => {
            const msg = doc.data();
            const div = document.createElement("div");
            div.textContent = `${msg.senderId === adminId ? 'Admin' : 'User'}: ${msg.message}`;
            chatBox.appendChild(div);
        });
    });
});

// Send a message
sendButton.addEventListener("click", async () => {
    const receiverId = userSelect.value;
    const message = messageInput.value.trim();
    if (!message || !receiverId) return;

    await addDoc(collection(db, "messages"), {
        senderId: adminId,
        receiverId,
        message,
        timestamp: serverTimestamp()
    });

    messageInput.value = ""; // Clear the input field after sending
});

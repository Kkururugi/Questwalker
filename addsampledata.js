// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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

// Sample user
async function addSampleUser() {
  const userRef = await addDoc(collection(db, "users"), {
    firstName: "Test",
    lastName: "User",
    email: "testuser@example.com",
    banned: false
  });
  console.log("Sample user added with ID:", userRef.id);
  return userRef.id;
}

// Sample quest
async function addSampleQuest(userId) {
  const questRef = await addDoc(collection(db, "quests"), {
    title: "Deliver Package",
    description: "Deliver a small package to John's house.",
    location: "Maple Street",
    duration: 2,
    category: "Delivery",
    createdAt: Timestamp.now(),
    completionDate: Timestamp.fromDate(new Date(Date.now() + 86400000)), // 1 day later
    userId: userId
  });
  console.log("Sample quest added with ID:", questRef.id);
  return questRef.id;
}

// Sample report
async function addSampleReport(questId, userId) {
  const reportRef = await addDoc(collection(db, "reports"), {
    questId: questId,
    reportedBy: userId,
    reason: "Suspicious activity",
    timestamp: Timestamp.now()
  });
  console.log("Sample report added with ID:", reportRef.id);
}

// Main
(async function () {
  const userId = await addSampleUser();
  const questId = await addSampleQuest(userId);
  await addSampleReport(questId, userId);
})();

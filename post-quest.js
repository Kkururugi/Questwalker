import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  serverTimestamp 
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

async function loadCategories() {
  const categoriesRef = collection(db, "categories");
  const querySnapshot = await getDocs(categoriesRef);
  const categorySelect = document.getElementById("questCategory");

  categorySelect.innerHTML = "<option value='' disabled selected>Select a Category</option>";

  querySnapshot.forEach(doc => {
    const category = doc.data();
    const option = document.createElement("option");
    option.value = category.name;
    option.innerText = category.name;
    categorySelect.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById("hamburger");
  const mobileSidebar = document.getElementById("mobile-sidebar");
  const profileImg = document.getElementById("profile-img");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      mobileSidebar.classList.toggle("hidden");
    });
  }

  if (profileImg) {
    profileImg.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }

  document.getElementById("questForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("questTitle").value.trim();
    const description = document.getElementById("questDescription").value.trim();
    const location = document.getElementById("questLocation").value.trim();
    const category = document.getElementById("questCategory").value;
    const completionDate = document.getElementById("questCompletionDate").value;
    const duration = document.getElementById("questDuration").value;

    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in to post a quest.");
        return;
      }

      await addDoc(collection(db, "quests"), {
        title,
        description,
        location,
        category,
        completionDate,
        duration,
        createdAt: serverTimestamp(),
        userId: user.uid,
        status: "open"
      });

      alert("Quest posted successfully!");
      window.location.href = "quests.html";
    } catch (error) {
      console.error("Error posting quest:", error);
      alert("There was an error posting the quest. Please try again.");
    }
  });
});

// Load categories and check auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    loadCategories();
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Update username display in header
        const displayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "User";
        
        // Update all username elements
        const usernameElements = [
          document.getElementById("username-display"),
          document.getElementById("mobile-username-display")
        ];
        
        usernameElements.forEach(el => {
          if (el) el.textContent = displayName;
        });

        // Update profile images
        const profileImageUrl = userData.profilePic || 
                             user.photoURL || 
                             "https://storage.googleapis.com/a1aa/image/d0adfb58-67ae-4431-bd62-8ec5c2035b76.jpg";
        
        // Update all profile image elements
        const profileImgElements = [
          document.getElementById("profile-img"),
          document.getElementById("mobile-profile-img")
        ];
        
        profileImgElements.forEach(img => {
          if (img) img.src = profileImageUrl;
        });

        // Check if user is admin
        if (userData.role === "admin") {
          document.getElementById('admin-link-container')?.classList.remove('hidden');
          document.getElementById('mobile-admin-link')?.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  } else {
    window.location.href = "index.html";
  }
});
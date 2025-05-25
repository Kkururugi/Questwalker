// Firebase imports (adjust if not already in your global setup)
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// Assumes Firebase has been initialized elsewhere
const auth = getAuth();
const db = getFirestore();

const hamburger = document.getElementById("hamburger");
const navMenu = document.getElementById("nav-menu");
const userControls = document.getElementById("user-controls");
const profileImgNav = document.getElementById("profile-img");

// Toggle nav menu
hamburger.addEventListener("click", () => {
  navMenu.classList.toggle("hidden");
});

// Show profile pic if logged in and viewing own profile
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userControls.style.display = "flex";

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const profilePic = userDoc.data().profilePic;
      if (profilePic) {
        profileImgNav.src = profilePic;
      }
    }

    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (userDocSnap.exists() && userDocSnap.data().role === "admin") {
      document.getElementById("admin-link-container").style.display = "block";
    }
  } else {
    userControls.style.display = "none";
  }
});

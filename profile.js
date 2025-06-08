import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import {
  getFirestore,
  getDoc,
  doc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCbLK26irLxdz03rDCMVHnqHYfDgBjn10g",
  authDomain: "questwalker-5c547.firebaseapp.com",
  projectId: "questwalker-5c547",
  storageBucket: "questwalker-5c547.appspot.com",
  messagingSenderId: "1058097550838",
  appId: "1:1058097550838:web:7bdbb645be374c93e4e3d7",
  measurementId: "G-NNQV9FQRV0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;
let reviewedUserId = null;
let lastVisible = null;
let currentPage = 1;
const reviewsPerPage = 5;
let currentSort = 'newest';

// DOM elements
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const logoutBtn = document.getElementById("logout-btn");
const saveAboutMeBtn = document.getElementById("saveAboutMe");
const submitReviewBtn = document.getElementById("submit-review");
const sortReviewsSelect = document.getElementById("sort-reviews");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const profileImageUpload = document.getElementById("profileImageUpload");
const changePicContainer = document.getElementById("change-pic-container");
const profilePicMain = document.getElementById("profilePic");
const mobileSidebar = document.getElementById("mobile-sidebar");

const picModal = document.getElementById("picModal");
const previewImage = document.getElementById("previewImage");
const confirmPic = document.getElementById("confirmPic");
const cancelPic = document.getElementById("cancelPic");

let newImageData = null;

// Mobile menu toggle
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    mobileSidebar.classList.toggle("hidden");
  });
}

// Auth check and profile load
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log('User is signed in:', currentUserId);

    // Get profile being viewed
    const urlParams = new URLSearchParams(window.location.search);
    reviewedUserId = urlParams.get('id') || user.uid;

    const userRef = doc(db, "users", reviewedUserId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`;
      document.getElementById("user-name").textContent = fullName;
      
      // Update all profile images
      const profilePic = data.profilePic || "profile-placeholder.png";
      profilePicMain.src = profilePic;
      document.getElementById("header-profile-img").src = profilePic;
      document.getElementById("mobile-profile-img").src = profilePic;
      document.getElementById("mobile-sidebar-profile-img").src = profilePic;

      document.getElementById("aboutMeInput").value = data.aboutMe || "";

      // Update username displays
      document.getElementById("username-display").textContent = fullName || "User";
      document.getElementById("mobile-username-display").textContent = fullName || "User";

      // Show "Change Picture" UI if viewing own profile
      if (currentUserId === reviewedUserId) {
        changePicContainer.style.display = "block";
      }

      // Admin link
      const currentUserDoc = await getDoc(doc(db, "users", currentUserId));
      if (currentUserDoc.exists() && currentUserDoc.data().role === "admin") {
        document.getElementById("admin-link-container").style.display = "block";
        document.getElementById("mobile-admin-link").style.display = "block";
      }

      // Hide About Me editing if viewing someone else
      const aboutMeInput = document.getElementById("aboutMeInput");
      if (currentUserId !== reviewedUserId) {
        aboutMeInput.disabled = true;
        saveAboutMeBtn.style.display = "none";
      }

      // Hide review form for own profile
      const reviewForm = document.getElementById("review-form-container");
      reviewForm.style.display = currentUserId === reviewedUserId ? "none" : "block";

      loadReviews();
    }
  } else {
    window.location.href = "index.html";
  }
});

// Profile picture preview & modal confirm
if (profileImageUpload) {
  profileImageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      newImageData = reader.result;
      previewImage.src = newImageData;
      picModal.style.display = "flex";
    };
    reader.readAsDataURL(file);
  });
}

if (confirmPic) {
  confirmPic.addEventListener("click", async () => {
    if (!newImageData) return;
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        profilePic: newImageData
      });
      
      // Update all profile images
      profilePicMain.src = newImageData;
      document.getElementById("header-profile-img").src = newImageData;
      document.getElementById("mobile-profile-img").src = newImageData;
      document.getElementById("mobile-sidebar-profile-img").src = newImageData;
      
      alert("Profile picture updated!");
    } catch (err) {
      console.error("Failed to update profile pic:", err);
      alert("Error saving picture.");
    } finally {
      picModal.style.display = "none";
      newImageData = null;
    }
  });
}

if (cancelPic) {
  cancelPic.addEventListener("click", () => {
    picModal.style.display = "none";
    newImageData = null;
  });
}

// Save About Me
if (saveAboutMeBtn) {
  saveAboutMeBtn.addEventListener("click", async () => {
    const aboutMe = document.getElementById("aboutMeInput").value;
    if (currentUserId) {
      try {
        await updateDoc(doc(db, "users", currentUserId), { aboutMe });
        alert("About Me updated successfully!");
      } catch (error) {
        console.error("Error updating About Me:", error);
        alert("Error updating About Me.");
      }
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => (window.location.href = "index.html"))
      .catch((error) => console.error("Logout error:", error));
  });
}

// Submit Review
if (submitReviewBtn) {
  submitReviewBtn.addEventListener("click", async () => {
    try {
      const rating = parseInt(document.getElementById("rating-select").value);
      const comment = document.getElementById("review-text").value.trim();

      if (!comment) return alert("Please enter a review comment");
      if (currentUserId === reviewedUserId) return alert("You cannot review yourself");

      const reviewerData = await getDoc(doc(db, "users", currentUserId));

      await addDoc(collection(db, "users", reviewedUserId, "reviews"), {
        reviewerId: currentUserId,
        reviewerName: reviewerData.data().firstName || "Anonymous",
        rating,
        comment,
        timestamp: new Date()
      });

      document.getElementById("review-text").value = "";
      alert("Thank you for your review!");
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review.");
    }
  });
}

// Sorting
if (sortReviewsSelect) {
  sortReviewsSelect.addEventListener("change", () => {
    currentSort = sortReviewsSelect.value;
    currentPage = 1;
    loadReviews();
  });
}

// Pagination
if (prevPageBtn) {
  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadReviews();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener("click", () => {
    currentPage++;
    loadReviews();
  });
}

// Load Reviews
async function loadReviews() {
  try {
    const reviewsContainer = document.getElementById("reviews-list");
    if (!reviewsContainer) return;
    
    reviewsContainer.innerHTML = "Loading reviews...";

    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;

    let sortField, sortDirection;
    switch (currentSort) {
      case 'newest': sortField = 'timestamp'; sortDirection = 'desc'; break;
      case 'oldest': sortField = 'timestamp'; sortDirection = 'asc'; break;
      case 'highest': sortField = 'rating'; sortDirection = 'desc'; break;
      case 'lowest': sortField = 'rating'; sortDirection = 'asc'; break;
      default: sortField = 'timestamp'; sortDirection = 'desc';
    }

    const offset = (currentPage - 1) * reviewsPerPage;

    let reviewsQuery;
    if (currentPage === 1) {
      reviewsQuery = query(
        collection(db, "users", reviewedUserId, "reviews"),
        orderBy(sortField, sortDirection),
        limit(reviewsPerPage)
      );
    } else {
      reviewsQuery = query(
        collection(db, "users", reviewedUserId, "reviews"),
        orderBy(sortField, sortDirection),
        startAfter(lastVisible),
        limit(reviewsPerPage)
      );
    }

    const snapshot = await getDocs(reviewsQuery);
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    reviewsContainer.innerHTML = "";

    if (snapshot.empty) {
      reviewsContainer.innerHTML = "No reviews found.";
      updatePageInfo();
      return;
    }

    snapshot.forEach((doc) => {
      const r = doc.data();
      const date = r.timestamp?.toDate() || new Date();
      const div = document.createElement("div");
      div.className = "review-item";
      div.innerHTML = `
        <strong>${r.reviewerName || "Anonymous"}</strong>
        <div class="review-rating">${"★".repeat(r.rating)}</div>
        <div class="review-date">${date.toLocaleDateString()}</div>
        <div class="review-text">${r.comment || "No comment"}</div>
      `;
      reviewsContainer.appendChild(div);
    });

    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = snapshot.size < reviewsPerPage;
    updatePageInfo();
    loadRatingSummary();
  } catch (err) {
    console.error("Error loading reviews:", err);
  }
}

// Rating Summary
async function loadRatingSummary() {
  try {
    const reviewsRef = collection(db, "users", reviewedUserId, "reviews");
    const snapshot = await getDocs(reviewsRef);

    let total = 0;
    let count = 0;
    const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

    snapshot.forEach((doc) => {
      const r = doc.data();
      total += r.rating;
      count++;
      ratingCounts[r.rating]++;
    });

    const avg = count ? (total / count).toFixed(1) : "0";
    document.getElementById("average-rating").textContent = avg;
    document.getElementById("average-stars").textContent = "★".repeat(Math.round(avg));
    document.getElementById("review-count").textContent = `(${count} reviews)`;

    for (let i = 1; i <= 5; i++) {
      const percent = count ? (ratingCounts[i] / count * 100) : 0;
      document.getElementById(`bar-${i}`).style.width = `${percent}%`;
      document.getElementById(`count-${i}`).textContent = ratingCounts[i];
    }
  } catch (err) {
    console.error("Error loading rating summary:", err);
  }
}

function updatePageInfo() {
  const pageInfo = document.getElementById("page-info");
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage}`;
  }
}
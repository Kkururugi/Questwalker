// Import Firebase SDKs
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { 
  getFirestore, 
  setDoc, 
  doc, 
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";

// Firebase Config
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
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Function to show messages
function showMessage(message, divId) {
    const messageDiv = document.getElementById(divId);
    messageDiv.style.display = "block";
    messageDiv.textContent = message;
    messageDiv.classList.add('show');
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            messageDiv.style.display = "none";
        }, 500);
    }, 5000);
}

// Toggle between forms
const signUpButton = document.getElementById('signUpButton');
const signInButton = document.getElementById('signInButton');
const forgotPasswordButton = document.getElementById('forgotPasswordButton');
const signUpContainer = document.getElementById('signup');
const signInContainer = document.getElementById('signIn');
const forgotPasswordContainer = document.getElementById('forgotPassword');

// Show Sign-Up form
signUpButton?.addEventListener('click', () => {
    signInContainer.style.display = "none";
    forgotPasswordContainer.style.display = "none";
    signUpContainer.style.display = "block";
});

// Show Sign-In form
signInButton?.addEventListener('click', () => {
    signUpContainer.style.display = "none";
    forgotPasswordContainer.style.display = "none";
    signInContainer.style.display = "block";
});

// Show Forgot Password form
forgotPasswordButton?.addEventListener('click', () => {
    signUpContainer.style.display = "none";
    signInContainer.style.display = "none";
    forgotPasswordContainer.style.display = "block";
});

// Back to Sign In from Forgot Password
const backToSignIn = document.getElementById('backToSignIn');
backToSignIn?.addEventListener('click', () => {
    forgotPasswordContainer.style.display = "none";
    signInContainer.style.display = "block";
});

// Sign-Up Event
const signUp = document.getElementById('submitSignUp');
signUp?.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('rEmail').value;
    const password = document.getElementById('rPassword').value;
    const firstName = document.getElementById('fName').value;
    const lastName = document.getElementById('lName').value;

    if (!email || !password || !firstName || !lastName) {
        showMessage('Please fill out all fields.', 'signUpMessage');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userData = {
            email: email,
            firstName: firstName,
            lastName: lastName,
            role: "user",
            banned: false,
            createdAt: new Date()
        };

        await setDoc(doc(db, "users", user.uid), userData);
        await sendEmailVerification(auth.currentUser);
        
        showMessage('Account created! Verification email sent. Please check your inbox.', 'signUpMessage');
    } catch (error) {
        console.error("Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            showMessage('Email already in use', 'signUpMessage');
        } else if (error.code === 'auth/invalid-email') {
            showMessage('Invalid email', 'signUpMessage');
        } else if (error.code === 'auth/weak-password') {
            showMessage('Password should be at least 6 characters', 'signUpMessage');
        } else {
            showMessage('Error creating account', 'signUpMessage');
        }
    }
});

// Sign-In Event
const signIn = document.getElementById('submitSignIn');
signIn?.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
            await signOut(auth);
            showMessage('Please verify your email before logging in.', 'signInMessage');
            return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().banned === true) {
            await signOut(auth);
            showMessage('Account banned. Contact support.', 'signInMessage');
            return;
        }

        localStorage.setItem('loggedInUserId', user.uid);
        window.location.href = 'homepage.html';
    } catch (error) {
        console.error("Error:", error);
        if (error.code === 'auth/invalid-credential') {
            showMessage('Invalid email or password', 'signInMessage');
        } else if (error.code === 'auth/user-not-found') {
            showMessage('User not found', 'signInMessage');
        } else {
            showMessage('Login failed', 'signInMessage');
        }
    }
});

// Forgot Password Event
const resetPassword = document.getElementById('submitForgotPassword');
resetPassword?.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;

    if (!email) {
        showMessage('Please enter your email', 'forgotPasswordMessage');
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showMessage('Password reset email sent. Check your inbox.', 'forgotPasswordMessage');
        setTimeout(() => {
            signInContainer.style.display = "block";
            forgotPasswordContainer.style.display = "none";
        }, 3000);
    } catch (error) {
        console.error("Error:", error);
        if (error.code === 'auth/user-not-found') {
            showMessage('No account with this email', 'forgotPasswordMessage');
        } else {
            showMessage('Error sending reset email', 'forgotPasswordMessage');
        }
    }
});

// Google Sign In/Up
document.getElementById('googleSignIn')?.addEventListener('click', handleGoogleSignIn);
document.getElementById('googleSignUp')?.addEventListener('click', handleGoogleSignIn);

async function handleGoogleSignIn() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await ensureUserDocument(user);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().banned === true) {
            await signOut(auth);
            showMessage('Account banned. Contact support.', 'signInMessage');
            return;
        }
        
        localStorage.setItem('loggedInUserId', user.uid);
        window.location.href = 'homepage.html';
    } catch (error) {
        console.error("Error:", error);
        showMessage(error.message, 'signInMessage');
    }
}

// Facebook Sign In/Up
document.getElementById('facebookSignIn')?.addEventListener('click', handleFacebookSignIn);
document.getElementById('facebookSignUp')?.addEventListener('click', handleFacebookSignIn);

async function handleFacebookSignIn() {
    try {
        const result = await signInWithPopup(auth, facebookProvider);
        const user = result.user;
        await ensureUserDocument(user);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().banned === true) {
            await signOut(auth);
            showMessage('Account banned. Contact support.', 'signInMessage');
            return;
        }
        
        localStorage.setItem('loggedInUserId', user.uid);
        window.location.href = 'homepage.html';
    } catch (error) {
        console.error("Error:", error);
        showMessage(error.message, 'signInMessage');
    }
}

// Ensure user document exists (for social logins)
async function ensureUserDocument(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
        const nameParts = user.displayName?.split(" ") || ["New", "User"];
        await setDoc(userDocRef, {
            email: user.email,
            firstName: nameParts[0],
            lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User",
            role: "user",
            banned: false,
            createdAt: new Date()
        });
    }
}
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

// Register user
export const registerUser = async (email, password, username) => {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with username
    await updateProfile(user, {
      displayName: username
    });
    
    // Save user data to Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email,
      highScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return user;
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
};

// Login user
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
};

// Logout user
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
};

// Update high score
export const updateHighScore = async (userId, newScore) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentHighScore = userSnap.data().highScore || 0;
      
      if (newScore > currentHighScore) {
        await setDoc(userRef, {
          highScore: newScore,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (error) {
    console.error("Error updating high score:", error);
  }
};

// Subscribe to leaderboard
export const subscribeLeaderboard = (callback, type = "global") => {
  try {
    const q = query(
      collection(db, "users"),
      orderBy("highScore", "desc"),
      limit(10)
    );
    
    return onSnapshot(q, (snapshot) => {
      const leaderboard = snapshot.docs.map((doc, index) => ({
        userId: doc.id,
        username: doc.data().username || "Anonymous",
        highScore: doc.data().highScore || 0,
        rank: index + 1,
        ...doc.data()
      }));
      callback(leaderboard);
    }, (error) => {
      console.error("Error in leaderboard subscription:", error);
      callback([]);
    });
  } catch (error) {
    console.error("Error setting up leaderboard:", error);
    callback([]);
    return () => {}; // Return empty unsubscribe function
  }
};

// Helper function to get user-friendly error messages
const getErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Email is already registered. Please use a different email or login.';
    case 'auth/invalid-email':
      return 'Invalid email address. Please check and try again.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please register first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return 'An error occurred. Please try again.';
  }
};
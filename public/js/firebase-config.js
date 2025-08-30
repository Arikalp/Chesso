// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCph_wLOHZER91knLPde_SLJWjy08rIRJU",
  authDomain: "chesso-c8284.firebaseapp.com",
  projectId: "chesso-c8284",
  storageBucket: "chesso-c8284.firebasestorage.app",
  messagingSenderId: "534478821988",
  appId: "1:534478821988:web:3eb31525ff6e4b0da3dd71",
  measurementId: "G-L3CKNZKT1Y"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    localStorage.setItem('userToken', user.accessToken);
    localStorage.setItem('userId', user.uid);
    localStorage.setItem('userName', user.displayName || user.email);
  } else {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
  }
});
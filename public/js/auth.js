// Check if user is already logged in
auth.onAuthStateChanged((user) => {
  if (user) {
    window.location.href = '/lobby';
  }
});

function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
  document.querySelectorAll('.tab-btn')[1].classList.remove('active');
}

function showSignup() {
  document.getElementById('signup-form').classList.remove('hidden');
  document.getElementById('login-form').classList.add('hidden');
  document.querySelectorAll('.tab-btn')[1].classList.add('active');
  document.querySelectorAll('.tab-btn')[0].classList.remove('active');
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = '/lobby';
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
}

async function signup() {
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  if (!name || !email || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });
    
    // Store user data in Firestore
    await db.collection('users').doc(result.user.uid).set({
      name: name,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isOnline: true
    });
    
    window.location.href = '/lobby';
  } catch (error) {
    alert('Signup failed: ' + error.message);
  }
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  try {
    const result = await auth.signInWithPopup(provider);
    
    // Store user data in Firestore
    await db.collection('users').doc(result.user.uid).set({
      name: result.user.displayName,
      email: result.user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isOnline: true
    }, { merge: true });
    
    window.location.href = '/lobby';
  } catch (error) {
    alert('Google sign-in failed: ' + error.message);
  }
}
# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "chesso-multiplayer")
4. Enable Google Analytics (optional)
5. Create project

## 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable:
   - Email/Password
   - Google (optional but recommended)

## 3. Create Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users

## 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon to add web app
4. Register app with nickname
5. Copy the configuration object

## 5. Update Configuration Files

### Update `public/js/firebase-config.js`:
Replace the firebaseConfig object with your actual configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-actual-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-actual-app-id"
};
```

## 6. Set up Firebase Admin (Optional - for server-side features)

1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Place it in your project root
5. Uncomment and update the admin initialization in `app.js`:

```javascript
admin.initializeApp({
  credential: admin.credential.cert(require('./your-service-account-key.json'))
});
```

## 7. Firestore Security Rules (for production)

Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Game invites
    match /gameInvites/{inviteId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.fromUserId || 
         request.auth.uid == resource.data.toUserId);
    }
    
    // Game rooms
    match /gameRooms/{roomId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 8. Install Dependencies

Run in your project directory:
```bash
npm install
```

## 9. Start the Application

```bash
npm start
```

Your chess application should now be running with Firebase authentication and real-time multiplayer features!
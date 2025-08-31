let currentUser = null;

// Check authentication
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = '/auth';
    return;
  }
  
  currentUser = user;
  document.getElementById('user-name').textContent = user.displayName || user.email;
  
  // No Socket.IO needed - using Firebase Firestore only
  
  // Update user online status
  updateUserOnlineStatus(true);
  
  // Load online players
  loadOnlinePlayers();
  
  // Listen for game invitations
  listenForInvitations();
  
  // Listen for game notifications
  listenForGameNotifications();
  
  // Check if user was in matchmaking queue
  checkExistingMatchmaking();
  
  // Load friends and friend requests
  loadFriends();
  loadFriendRequests();
  
  // Initialize global chat
  initializeGlobalChat();
});

// Global Chat System
function initializeGlobalChat() {
  // Listen for new chat messages
  db.collection('globalChat')
    .orderBy('timestamp', 'asc')
    .limit(50)
    .onSnapshot((snapshot) => {
      const chatMessages = document.getElementById('chat-messages');
      chatMessages.innerHTML = '';
      
      if (snapshot.empty) {
        chatMessages.innerHTML = '<div class="empty-chat">No messages yet. Start the conversation!</div>';
        return;
      }
      
      snapshot.forEach((doc) => {
        const message = doc.data();
        displayChatMessage(message, doc.id);
      });
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  
  // Add enter key listener for chat input
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
}

function displayChatMessage(message, messageId) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${message.userId === currentUser.uid ? 'own' : 'other'}`;
  
  const time = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'now';
  
  const deleteButton = message.userId === currentUser.uid ? 
    `<button class="message-menu" onclick="deleteMessage('${messageId}')">⋯</button>` : '';
  
  messageDiv.innerHTML = `
    ${message.userId !== currentUser.uid ? `<div class="message-sender">${message.userName}</div>` : ''}
    <div class="message-content">
      <div class="message-text">${escapeHtml(message.text)}</div>
      ${deleteButton}
    </div>
    <div class="message-time">${time}</div>
  `;
  
  chatMessages.appendChild(messageDiv);
}

function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const messageText = chatInput.value.trim();
  
  if (!messageText || !currentUser) return;
  
  // Send message to Firestore
  db.collection('globalChat').add({
    userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email,
    text: messageText,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    chatInput.value = '';
  }).catch(error => {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  });
}

function deleteMessage(messageId) {
  if (confirm('Delete this message?')) {
    db.collection('globalChat').doc(messageId).delete()
      .catch(error => {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
      });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateUserOnlineStatus(isOnline) {
  if (currentUser) {
    // Generate player ID if not exists
    const playerId = generatePlayerId(currentUser.uid);
    
    db.collection('users').doc(currentUser.uid).set({
      name: currentUser.displayName || currentUser.email,
      email: currentUser.email,
      playerId: playerId,
      isOnline: isOnline,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
      // Display player ID
      document.getElementById('my-player-id').textContent = `#${playerId}`;
    }).catch(error => {
      console.error('Error updating user status:', error);
    });
  }
}

function generatePlayerId(uid) {
  // Generate a 6-character ID based on UID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const hash = uid.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  for (let i = 0; i < 6; i++) {
    result += chars[Math.abs(hash + i) % chars.length];
  }
  return result;
}

function loadOnlinePlayers() {
  db.collection('users')
    .where('isOnline', '==', true)
    .onSnapshot(async (snapshot) => {
      const playersList = document.getElementById('players-list');
      playersList.innerHTML = '';
      
      for (const doc of snapshot.docs) {
        const player = doc.data();
        if (doc.id !== currentUser.uid) {
          const playerElement = await createPlayerElement(doc.id, player);
          playersList.appendChild(playerElement);
        }
      }
    });
}

async function createPlayerElement(playerId, player) {
  const div = document.createElement('div');
  div.className = 'player-item';
  
  // Check friendship status
  const friendshipStatus = await getFriendshipStatus(playerId);
  let friendButton = '';
  
  if (friendshipStatus === 'none') {
    friendButton = `<button class="friend-btn" onclick="sendFriendRequest('${playerId}', '${player.name}')">Add Friend</button>`;
  } else if (friendshipStatus === 'pending-sent') {
    friendButton = `<button class="friend-btn pending" disabled>Request Sent</button>`;
  } else if (friendshipStatus === 'pending-received') {
    friendButton = `<button class="friend-btn" onclick="acceptFriendRequest('${playerId}')">Accept</button>`;
  } else if (friendshipStatus === 'friends') {
    friendButton = `<button class="friend-btn" disabled>Friends</button>`;
  }
  
  div.innerHTML = `
    <div>
      <div class="player-name">${player.name}</div>
      <div class="player-status">Online • ID: #${player.playerId || 'N/A'}</div>
    </div>
    <div>
      <button class="invite-btn" onclick="sendGameInvite('${playerId}', '${player.name}')">
        Invite to Play
      </button>
      ${friendButton}
    </div>
  `;
  return div;
}

function listenForInvitations() {
  db.collection('gameInvites')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
      const invitesList = document.getElementById('invites-list');
      invitesList.innerHTML = '';
      
      snapshot.forEach((doc) => {
        const invite = doc.data();
        const inviteElement = createInviteElement(doc.id, invite);
        invitesList.appendChild(inviteElement);
      });
    });
}

function createInviteElement(inviteId, invite) {
  const div = document.createElement('div');
  div.className = 'invite-item';
  div.innerHTML = `
    <div>
      <div class="player-name">${invite.fromUserName}</div>
      <div class="player-status">wants to play chess</div>
    </div>
    <div>
      <button class="accept-btn" onclick="acceptInvite('${inviteId}')">Accept</button>
      <button class="decline-btn" onclick="declineInvite('${inviteId}')">Decline</button>
    </div>
  `;
  return div;
}

async function sendGameInvite(toUserId, toUserName) {
  try {
    await db.collection('gameInvites').add({
      fromUserId: currentUser.uid,
      fromUserName: currentUser.displayName || currentUser.email,
      toUserId: toUserId,
      toUserName: toUserName,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`Invitation sent to ${toUserName}!`);
  } catch (error) {
    alert('Failed to send invitation: ' + error.message);
  }
}

async function acceptInvite(inviteId) {
  try {
    const inviteDoc = await db.collection('gameInvites').doc(inviteId).get();
    const invite = inviteDoc.data();
    
    // Create game room
    const gameRoom = await db.collection('gameRooms').add({
      player1: {
        uid: invite.fromUserId,
        name: invite.fromUserName,
        color: 'white'
      },
      player2: {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        color: 'black'
      },
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      gameStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    });
    
    // Update invite status with game room ID
    await db.collection('gameInvites').doc(inviteId).update({
      status: 'accepted',
      gameRoomId: gameRoom.id
    });
    
    // Create notification for the inviting player
    await db.collection('gameNotifications').add({
      userId: invite.fromUserId,
      type: 'gameReady',
      gameRoomId: gameRoom.id,
      message: `${currentUser.displayName || currentUser.email} accepted your invitation!`,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
    // Redirect to game
    window.location.href = `/game/${gameRoom.id}`;
  } catch (error) {
    alert('Failed to accept invitation: ' + error.message);
  }
}

async function declineInvite(inviteId) {
  try {
    await db.collection('gameInvites').doc(inviteId).update({
      status: 'declined'
    });
  } catch (error) {
    alert('Failed to decline invitation: ' + error.message);
  }
}

async function findQuickMatch() {
  try {
    const button = event.target;
    button.textContent = 'Searching...';
    button.disabled = true;
    
    // Look for waiting players (simplified query)
    const waitingPlayers = await db.collection('matchmaking')
      .where('status', '==', 'waiting')
      .limit(10)
      .get();
    
    // Filter out current user from results
    const availableOpponents = waitingPlayers.docs.filter(doc => 
      doc.data().userId !== currentUser.uid
    );
    
    if (availableOpponents.length > 0) {
      // Found a match! Create game with the first available player
      const opponent = availableOpponents[0];
      const opponentData = opponent.data();
      
      // Create game room
      const gameRoom = await db.collection('gameRooms').add({
        player1: {
          uid: opponentData.userId,
          name: opponentData.userName,
          color: 'white'
        },
        player2: {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email,
          color: 'black'
        },
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        gameStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        matchType: 'quickMatch'
      });
      
      // Remove opponent from queue
      await db.collection('matchmaking').doc(opponent.id).delete();
      
      // Create notification for opponent
      await db.collection('gameNotifications').add({
        userId: opponentData.userId,
        type: 'quickMatchFound',
        gameRoomId: gameRoom.id,
        message: `Quick match found! Playing against ${currentUser.displayName || currentUser.email}`,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });
      
      // Redirect to game
      window.location.href = `/game/${gameRoom.id}`;
      
    } else {
      // No match found, add to matchmaking queue
      await db.collection('matchmaking').add({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        status: 'waiting',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Listen for match found
      listenForQuickMatch();
      
      button.textContent = 'Cancel Search';
      button.onclick = cancelQuickMatch;
    }
    
  } catch (error) {
    console.error('Quick match error:', error);
    alert('Failed to find match: ' + error.message);
    const button = event.target;
    button.textContent = 'Find Match';
    button.disabled = false;
  }
}

async function createGame() {
  try {
    const gameRoom = await db.collection('gameRooms').add({
      player1: {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        color: 'white'
      },
      player2: null,
      status: 'waiting',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    });
    
    const roomCode = gameRoom.id.substring(0, 6).toUpperCase();
    alert(`Game room created! Room code: ${roomCode}`);
    
    window.location.href = `/game/${gameRoom.id}`;
  } catch (error) {
    alert('Failed to create game: ' + error.message);
  }
}

async function joinGame() {
  const roomCode = document.getElementById('room-code').value.trim();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  
  try {
    // Find game room by partial ID match
    const snapshot = await db.collection('gameRooms')
      .where('status', '==', 'waiting')
      .get();
    
    let gameRoom = null;
    snapshot.forEach((doc) => {
      if (doc.id.substring(0, 6).toUpperCase() === roomCode.toUpperCase()) {
        gameRoom = { id: doc.id, data: doc.data() };
      }
    });
    
    if (!gameRoom) {
      alert('Game room not found or already full');
      return;
    }
    
    // Join the game
    await db.collection('gameRooms').doc(gameRoom.id).update({
      player2: {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        color: 'black'
      },
      status: 'active',
      gameStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.location.href = `/game/${gameRoom.id}`;
  } catch (error) {
    alert('Failed to join game: ' + error.message);
  }
}

async function logout() {
  try {
    updateUserOnlineStatus(false);
    await auth.signOut();
    window.location.href = '/auth';
  } catch (error) {
    alert('Logout failed: ' + error.message);
  }
}

function listenForGameNotifications() {
  db.collection('gameNotifications')
    .where('userId', '==', currentUser.uid)
    .where('read', '==', false)
    .onSnapshot((snapshot) => {
      snapshot.forEach((doc) => {
        const notification = doc.data();
        if (notification.type === 'gameReady' || notification.type === 'quickMatchFound') {
          // Mark as read
          db.collection('gameNotifications').doc(doc.id).update({ read: true });
          
          // Show notification and redirect
          if (confirm(notification.message + ' Click OK to join the game.')) {
            window.location.href = `/game/${notification.gameRoomId}`;
          }
        }
      });
    });
}

function listenForQuickMatch() {
  // Listen for game notifications instead of matchmaking status
  // This avoids complex queries and uses existing notification system
}

async function cancelQuickMatch() {
  try {
    // Remove from matchmaking queue (simplified)
    const matchmakingDocs = await db.collection('matchmaking')
      .where('userId', '==', currentUser.uid)
      .get();
    
    matchmakingDocs.forEach(async (doc) => {
      await db.collection('matchmaking').doc(doc.id).delete();
    });
    
    // Reset button
    const button = event.target;
    button.textContent = 'Find Match';
    button.onclick = findQuickMatch;
    button.disabled = false;
    
  } catch (error) {
    console.error('Cancel match error:', error);
  }
}

async function checkExistingMatchmaking() {
  try {
    const existingRequest = await db.collection('matchmaking')
      .where('userId', '==', currentUser.uid)
      .get();
    
    if (!existingRequest.empty) {
      // Clean up any old entries
      existingRequest.forEach(async (doc) => {
        await db.collection('matchmaking').doc(doc.id).delete();
      });
    }
  } catch (error) {
    console.error('Check matchmaking error:', error);
  }
}

// Friend system functions
async function getFriendshipStatus(userId) {
  try {
    const friendships = await db.collection('friendships')
      .where('users', 'array-contains', currentUser.uid)
      .get();
    
    for (const doc of friendships.docs) {
      const friendship = doc.data();
      if (friendship.users.includes(userId)) {
        if (friendship.status === 'accepted') {
          return 'friends';
        } else if (friendship.requesterId === currentUser.uid) {
          return 'pending-sent';
        } else {
          return 'pending-received';
        }
      }
    }
    return 'none';
  } catch (error) {
    console.error('Error checking friendship status:', error);
    return 'none';
  }
}

async function sendFriendRequest(toUserId, toUserName) {
  try {
    // Check if friendship already exists
    const existingFriendship = await db.collection('friendships')
      .where('users', 'array-contains', currentUser.uid)
      .get();
    
    let friendshipExists = false;
    existingFriendship.forEach((doc) => {
      const friendship = doc.data();
      if (friendship.users.includes(toUserId)) {
        friendshipExists = true;
      }
    });
    
    if (friendshipExists) {
      alert('Friendship already exists or request already sent!');
      return;
    }
    
    await db.collection('friendships').add({
      requesterId: currentUser.uid,
      requesterName: currentUser.displayName || currentUser.email,
      receiverId: toUserId,
      receiverName: toUserName,
      users: [currentUser.uid, toUserId],
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`Friend request sent to ${toUserName}!`);
    loadOnlinePlayers(); // Refresh to update button
  } catch (error) {
    alert('Failed to send friend request: ' + error.message);
  }
}

async function acceptFriendRequest(fromUserId) {
  try {
    const friendships = await db.collection('friendships')
      .where('requesterId', '==', fromUserId)
      .where('receiverId', '==', currentUser.uid)
      .where('status', '==', 'pending')
      .get();
    
    if (!friendships.empty) {
      await db.collection('friendships').doc(friendships.docs[0].id).update({
        status: 'accepted',
        acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      alert('Friend request accepted!');
      loadOnlinePlayers();
      loadFriends();
      loadFriendRequests();
    }
  } catch (error) {
    alert('Failed to accept friend request: ' + error.message);
  }
}

function loadFriends() {
  db.collection('friendships')
    .where('users', 'array-contains', currentUser.uid)
    .where('status', '==', 'accepted')
    .onSnapshot((snapshot) => {
      const friendsList = document.getElementById('friends-list');
      friendsList.innerHTML = '';
      
      const addedFriends = new Set(); // Prevent duplicates
      
      snapshot.forEach((doc) => {
        const friendship = doc.data();
        const friendId = friendship.users.find(id => id !== currentUser.uid);
        const friendName = friendship.requesterId === currentUser.uid ? 
          friendship.receiverName : friendship.requesterName;
        
        if (!addedFriends.has(friendId)) {
          addedFriends.add(friendId);
          const friendElement = createFriendElement(friendId, friendName);
          friendsList.appendChild(friendElement);
        }
      });
    });
}

function createFriendElement(friendId, friendName) {
  const div = document.createElement('div');
  div.className = 'player-item';
  div.innerHTML = `
    <div>
      <div class="player-name">${friendName}</div>
      <div class="player-status">Friend</div>
    </div>
    <div>
      <button class="invite-btn" onclick="sendGameInvite('${friendId}', '${friendName}')">
        Invite to Play
      </button>
    </div>
  `;
  return div;
}

function loadFriendRequests() {
  db.collection('friendships')
    .where('receiverId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
      const requestsList = document.getElementById('friend-requests-list');
      requestsList.innerHTML = '';
      
      snapshot.forEach((doc) => {
        const request = doc.data();
        const requestElement = createFriendRequestElement(doc.id, request);
        requestsList.appendChild(requestElement);
      });
    });
}

function createFriendRequestElement(requestId, request) {
  const div = document.createElement('div');
  div.className = 'player-item';
  div.innerHTML = `
    <div>
      <div class="player-name">${request.requesterName}</div>
      <div class="player-status">wants to be friends</div>
    </div>
    <div>
      <button class="accept-btn" onclick="acceptFriendRequestById('${requestId}')">
        Accept
      </button>
      <button class="decline-btn" onclick="declineFriendRequest('${requestId}')">
        Decline
      </button>
    </div>
  `;
  return div;
}

async function acceptFriendRequestById(requestId) {
  try {
    // Check if friendship already accepted to prevent duplicates
    const requestDoc = await db.collection('friendships').doc(requestId).get();
    if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
      alert('Friend request no longer valid!');
      return;
    }
    
    await db.collection('friendships').doc(requestId).update({
      status: 'accepted',
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    loadFriends();
    loadOnlinePlayers();
  } catch (error) {
    alert('Failed to accept friend request: ' + error.message);
  }
}

async function declineFriendRequest(requestId) {
  try {
    await db.collection('friendships').doc(requestId).delete();
  } catch (error) {
    alert('Failed to decline friend request: ' + error.message);
  }
}

async function searchPlayer() {
  const searchInput = document.getElementById('player-search');
  const playerId = searchInput.value.trim().replace('#', '').toUpperCase();
  
  if (!playerId) {
    alert('Please enter a Player ID');
    return;
  }
  
  try {
    const usersSnapshot = await db.collection('users')
      .where('playerId', '==', playerId)
      .get();
    
    if (usersSnapshot.empty) {
      alert('Player not found!');
      return;
    }
    
    const playerDoc = usersSnapshot.docs[0];
    const playerData = playerDoc.data();
    const playerUid = playerDoc.id;
    
    if (playerUid === currentUser.uid) {
      alert('This is your own Player ID!');
      return;
    }
    
    // Check friendship status before showing options
    const friendshipStatus = await getFriendshipStatus(playerUid);
    let message = `Player found: ${playerData.name}\nPlayer ID: #${playerData.playerId}\n\n`;
    
    if (friendshipStatus === 'friends') {
      message += 'You are already friends! Click OK to send game invite.';
      if (confirm(message)) {
        await sendGameInvite(playerUid, playerData.name);
      }
    } else if (friendshipStatus === 'pending-sent') {
      message += 'Friend request already sent! Click OK to send game invite.';
      if (confirm(message)) {
        await sendGameInvite(playerUid, playerData.name);
      }
    } else if (friendshipStatus === 'pending-received') {
      message += 'This player sent you a friend request! Check your Friend Requests tab.';
      alert(message);
    } else {
      message += 'Click OK to send friend request, Cancel to send game invite.';
      if (confirm(message)) {
        await sendFriendRequest(playerUid, playerData.name);
      } else {
        await sendGameInvite(playerUid, playerData.name);
      }
    }
    
    searchInput.value = '';
    
  } catch (error) {
    console.error('Search error:', error);
    alert('Search failed: ' + error.message);
  }
}

function copyPlayerId() {
  const playerIdText = document.getElementById('my-player-id').textContent;
  navigator.clipboard.writeText(playerIdText).then(() => {
    const copyBtn = document.querySelector('.copy-btn-mini');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = playerIdText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Player ID copied!');
  });
}

function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.social-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.target.classList.add('active');
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  updateUserOnlineStatus(false);
  
  // Clean up matchmaking queue
  if (currentUser) {
    db.collection('matchmaking')
      .where('userId', '==', currentUser.uid)
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          db.collection('matchmaking').doc(doc.id).delete();
        });
      });
  }
});
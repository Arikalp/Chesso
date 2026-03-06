"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import styles from "./lobby.module.css";

function generatePlayerId(uid) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const hash = uid.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  for (let i = 0; i < 6; i++) {
    result += chars[Math.abs(hash + i) % chars.length];
  }
  return result;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [players, setPlayers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [invites, setInvites] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [myPlayerId, setMyPlayerId] = useState("#LOADING");
  const [activeTab, setActiveTab] = useState("players");
  const [isSearching, setIsSearching] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const chatRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  // Update user online status
  const updateUserOnlineStatus = useCallback(
    async (isOnline) => {
      if (!user) return;
      const playerId = generatePlayerId(user.uid);
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            name: user.displayName || user.email,
            email: user.email,
            playerId,
            isOnline,
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
        setMyPlayerId(`#${playerId}`);
      } catch (error) {
        console.error("Error updating user status:", error);
      }
    },
    [user]
  );

  // Get friendship status
  const getFriendshipStatus = useCallback(
    async (userId) => {
      if (!user) return "none";
      try {
        const q = query(
          collection(db, "friendships"),
          where("users", "array-contains", user.uid)
        );
        const snapshot = await getDocs(q);
        for (const d of snapshot.docs) {
          const friendship = d.data();
          if (friendship.users.includes(userId)) {
            if (friendship.status === "accepted") return "friends";
            if (friendship.requesterId === user.uid) return "pending-sent";
            return "pending-received";
          }
        }
        return "none";
      } catch {
        return "none";
      }
    },
    [user]
  );

  // Initialize everything on mount
  useEffect(() => {
    if (!user) return;

    updateUserOnlineStatus(true);

    // Load online players
    const playersQ = query(
      collection(db, "users"),
      where("isOnline", "==", true)
    );
    const unsubPlayers = onSnapshot(playersQ, async (snapshot) => {
      const playerList = [];
      const statusMap = {};
      for (const d of snapshot.docs) {
        if (d.id !== user.uid) {
          const playerData = d.data();
          const status = await getFriendshipStatus(d.id);
          statusMap[d.id] = status;
          playerList.push({ id: d.id, ...playerData });
        }
      }
      setPlayers(playerList);
      setFriendshipStatuses((prev) => ({ ...prev, ...statusMap }));
    });

    // Listen for invitations
    const invitesQ = query(
      collection(db, "gameInvites"),
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsubInvites = onSnapshot(invitesQ, (snapshot) => {
      const inviteList = [];
      snapshot.forEach((d) => inviteList.push({ id: d.id, ...d.data() }));
      setInvites(inviteList);
    });

    // Listen for game notifications
    const notifQ = query(
      collection(db, "gameNotifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsubNotifs = onSnapshot(notifQ, (snapshot) => {
      snapshot.forEach((d) => {
        const notification = d.data();
        if (
          notification.type === "gameReady" ||
          notification.type === "quickMatchFound"
        ) {
          updateDoc(doc(db, "gameNotifications", d.id), { read: true });
          if (confirm(notification.message + " Click OK to join the game.")) {
            router.push(`/game/${notification.gameRoomId}`);
          }
        }
      });
    });

    // Load friends
    const friendsQ = query(
      collection(db, "friendships"),
      where("users", "array-contains", user.uid),
      where("status", "==", "accepted")
    );
    const unsubFriends = onSnapshot(friendsQ, (snapshot) => {
      const friendList = [];
      const added = new Set();
      snapshot.forEach((d) => {
        const data = d.data();
        const friendId = data.users.find((id) => id !== user.uid);
        if (!added.has(friendId)) {
          added.add(friendId);
          const friendName =
            data.requesterId === user.uid
              ? data.receiverName
              : data.requesterName;
          friendList.push({ id: friendId, name: friendName });
        }
      });
      setFriends(friendList);
    });

    // Load friend requests
    const reqQ = query(
      collection(db, "friendships"),
      where("receiverId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsubRequests = onSnapshot(reqQ, (snapshot) => {
      const reqList = [];
      snapshot.forEach((d) => reqList.push({ id: d.id, ...d.data() }));
      setFriendRequests(reqList);
    });

    // Global chat
    const chatQ = query(
      collection(db, "globalChat"),
      orderBy("timestamp", "asc"),
      limit(50)
    );
    const unsubChat = onSnapshot(chatQ, (snapshot) => {
      const msgs = [];
      snapshot.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
    });

    // Cleanup matchmaking queue
    const cleanupMatchmaking = async () => {
      try {
        const mmQ = query(
          collection(db, "matchmaking"),
          where("userId", "==", user.uid)
        );
        const mmSnapshot = await getDocs(mmQ);
        mmSnapshot.forEach(async (d) => {
          await deleteDoc(doc(db, "matchmaking", d.id));
        });
      } catch (error) {
        console.error("Check matchmaking error:", error);
      }
    };
    cleanupMatchmaking();

    // Handle page unload
    const handleUnload = () => {
      updateUserOnlineStatus(false);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      unsubPlayers();
      unsubInvites();
      unsubNotifs();
      unsubFriends();
      unsubRequests();
      unsubChat();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user, updateUserOnlineStatus, getFriendshipStatus, router]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Actions
  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || !user) return;
    try {
      await addDoc(collection(db, "globalChat"), {
        userId: user.uid,
        userName: user.displayName || user.email,
        text,
        timestamp: serverTimestamp(),
      });
      setChatInput("");
    } catch (error) {
      alert("Failed to send message");
    }
  }

  async function deleteMessage(messageId) {
    if (confirm("Delete this message?")) {
      try {
        await deleteDoc(doc(db, "globalChat", messageId));
      } catch (error) {
        alert("Failed to delete message");
      }
    }
  }

  async function sendGameInvite(toUserId, toUserName) {
    try {
      await addDoc(collection(db, "gameInvites"), {
        fromUserId: user.uid,
        fromUserName: user.displayName || user.email,
        toUserId,
        toUserName,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert(`Invitation sent to ${toUserName}!`);
    } catch (error) {
      alert("Failed to send invitation: " + error.message);
    }
  }

  async function acceptInvite(inviteId) {
    try {
      const inviteDoc = await getDoc(doc(db, "gameInvites", inviteId));
      const invite = inviteDoc.data();

      const gameRoom = await addDoc(collection(db, "gameRooms"), {
        player1: { uid: invite.fromUserId, name: invite.fromUserName, color: "white" },
        player2: { uid: user.uid, name: user.displayName || user.email, color: "black" },
        status: "active",
        createdAt: serverTimestamp(),
        gameStartedAt: serverTimestamp(),
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      });

      await updateDoc(doc(db, "gameInvites", inviteId), {
        status: "accepted",
        gameRoomId: gameRoom.id,
      });

      await addDoc(collection(db, "gameNotifications"), {
        userId: invite.fromUserId,
        type: "gameReady",
        gameRoomId: gameRoom.id,
        message: `${user.displayName || user.email} accepted your invitation!`,
        createdAt: serverTimestamp(),
        read: false,
      });

      router.push(`/game/${gameRoom.id}`);
    } catch (error) {
      alert("Failed to accept invitation: " + error.message);
    }
  }

  async function declineInvite(inviteId) {
    try {
      await updateDoc(doc(db, "gameInvites", inviteId), { status: "declined" });
    } catch (error) {
      alert("Failed to decline invitation: " + error.message);
    }
  }

  async function findQuickMatch() {
    try {
      setIsSearching(true);

      const waitingQ = query(
        collection(db, "matchmaking"),
        where("status", "==", "waiting"),
        limit(10)
      );
      const waitingSnapshot = await getDocs(waitingQ);
      const available = waitingSnapshot.docs.filter(
        (d) => d.data().userId !== user.uid
      );

      if (available.length > 0) {
        const opponent = available[0];
        const opponentData = opponent.data();

        const gameRoom = await addDoc(collection(db, "gameRooms"), {
          player1: { uid: opponentData.userId, name: opponentData.userName, color: "white" },
          player2: { uid: user.uid, name: user.displayName || user.email, color: "black" },
          status: "active",
          createdAt: serverTimestamp(),
          gameStartedAt: serverTimestamp(),
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          matchType: "quickMatch",
        });

        await deleteDoc(doc(db, "matchmaking", opponent.id));

        await addDoc(collection(db, "gameNotifications"), {
          userId: opponentData.userId,
          type: "quickMatchFound",
          gameRoomId: gameRoom.id,
          message: `Quick match found! Playing against ${user.displayName || user.email}`,
          createdAt: serverTimestamp(),
          read: false,
        });

        router.push(`/game/${gameRoom.id}`);
      } else {
        await addDoc(collection(db, "matchmaking"), {
          userId: user.uid,
          userName: user.displayName || user.email,
          status: "waiting",
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      alert("Failed to find match: " + error.message);
      setIsSearching(false);
    }
  }

  async function cancelQuickMatch() {
    try {
      const mmQ = query(
        collection(db, "matchmaking"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(mmQ);
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, "matchmaking", d.id));
      }
      setIsSearching(false);
    } catch (error) {
      console.error("Cancel match error:", error);
    }
  }

  async function createGame() {
    try {
      const gameRoom = await addDoc(collection(db, "gameRooms"), {
        player1: { uid: user.uid, name: user.displayName || user.email, color: "white" },
        player2: null,
        status: "waiting",
        createdAt: serverTimestamp(),
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      });
      const code = gameRoom.id.substring(0, 6).toUpperCase();
      alert(`Game room created! Room code: ${code}`);
      router.push(`/game/${gameRoom.id}`);
    } catch (error) {
      alert("Failed to create game: " + error.message);
    }
  }

  async function joinGame() {
    if (!roomCode.trim()) {
      alert("Please enter a room code");
      return;
    }
    try {
      const q = query(
        collection(db, "gameRooms"),
        where("status", "==", "waiting")
      );
      const snapshot = await getDocs(q);
      let found = null;
      snapshot.forEach((d) => {
        if (d.id.substring(0, 6).toUpperCase() === roomCode.toUpperCase()) {
          found = { id: d.id, data: d.data() };
        }
      });

      if (!found) {
        alert("Game room not found or already full");
        return;
      }

      await updateDoc(doc(db, "gameRooms", found.id), {
        player2: { uid: user.uid, name: user.displayName || user.email, color: "black" },
        status: "active",
        gameStartedAt: serverTimestamp(),
      });

      router.push(`/game/${found.id}`);
    } catch (error) {
      alert("Failed to join game: " + error.message);
    }
  }

  async function sendFriendRequest(toUserId, toUserName) {
    try {
      const existingQ = query(
        collection(db, "friendships"),
        where("users", "array-contains", user.uid)
      );
      const existingSnapshot = await getDocs(existingQ);
      let exists = false;
      existingSnapshot.forEach((d) => {
        if (d.data().users.includes(toUserId)) exists = true;
      });
      if (exists) {
        alert("Friendship already exists or request already sent!");
        return;
      }

      await addDoc(collection(db, "friendships"), {
        requesterId: user.uid,
        requesterName: user.displayName || user.email,
        receiverId: toUserId,
        receiverName: toUserName,
        users: [user.uid, toUserId],
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert(`Friend request sent to ${toUserName}!`);
    } catch (error) {
      alert("Failed to send friend request: " + error.message);
    }
  }

  async function acceptFriendRequestById(requestId) {
    try {
      const reqDoc = await getDoc(doc(db, "friendships", requestId));
      if (!reqDoc.exists() || reqDoc.data().status !== "pending") {
        alert("Friend request no longer valid!");
        return;
      }
      await updateDoc(doc(db, "friendships", requestId), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
    } catch (error) {
      alert("Failed to accept friend request: " + error.message);
    }
  }

  async function declineFriendRequest(requestId) {
    try {
      await deleteDoc(doc(db, "friendships", requestId));
    } catch (error) {
      alert("Failed to decline friend request: " + error.message);
    }
  }

  async function searchPlayer() {
    const playerId = playerSearch.trim().replace("#", "").toUpperCase();
    if (!playerId) {
      alert("Please enter a Player ID");
      return;
    }
    try {
      const q = query(
        collection(db, "users"),
        where("playerId", "==", playerId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert("Player not found!");
        return;
      }
      const playerDoc = snapshot.docs[0];
      const playerData = playerDoc.data();
      const playerUid = playerDoc.id;

      if (playerUid === user.uid) {
        alert("This is your own Player ID!");
        return;
      }

      const status = await getFriendshipStatus(playerUid);
      let message = `Player found: ${playerData.name}\nPlayer ID: #${playerData.playerId}\n\n`;

      if (status === "friends") {
        message += "You are already friends! Click OK to send game invite.";
        if (confirm(message)) await sendGameInvite(playerUid, playerData.name);
      } else if (status === "pending-sent") {
        message += "Friend request already sent! Click OK to send game invite.";
        if (confirm(message)) await sendGameInvite(playerUid, playerData.name);
      } else if (status === "pending-received") {
        alert(message + "This player sent you a friend request! Check your Friend Requests tab.");
      } else {
        message += "Click OK to send friend request, Cancel to send game invite.";
        if (confirm(message)) await sendFriendRequest(playerUid, playerData.name);
        else await sendGameInvite(playerUid, playerData.name);
      }
      setPlayerSearch("");
    } catch (error) {
      alert("Search failed: " + error.message);
    }
  }

  function copyPlayerId() {
    navigator.clipboard.writeText(myPlayerId).then(() => {
      alert("Player ID copied!");
    });
  }

  async function handleLogout() {
    try {
      await updateUserOnlineStatus(false);
      await signOut(auth);
      router.push("/auth");
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  }

  if (loading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <h1>♔ Loading... ♛</h1>
      </div>
    );
  }

  return (
    <>
      <div className={styles.lobbyContainer}>
        <header className={styles.lobbyHeader}>
          <h1>♔ Chesso ♛</h1>
          <div className={styles.userInfo}>
            <button onClick={toggleTheme} className={styles.themeBtn}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <span>{user.displayName || user.email}</span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </header>

        <div className={styles.lobbyContent}>
          {/* Game Options */}
          <div className={styles.gameOptions}>
            <div className={styles.optionCard}>
              <h3>Quick Match</h3>
              <p>Find a random opponent</p>
              {isSearching ? (
                <button onClick={cancelQuickMatch} className={styles.primaryBtn}>
                  Cancel Search
                </button>
              ) : (
                <button onClick={findQuickMatch} className={styles.primaryBtn}>
                  Find Match
                </button>
              )}
            </div>

            <div className={styles.optionCard}>
              <h3>Create Game</h3>
              <p>Create a room and invite friends</p>
              <button onClick={createGame} className={styles.primaryBtn}>
                Create Room
              </button>
            </div>

            <div className={styles.optionCard}>
              <h3>Join Game</h3>
              <p>Enter room code to join</p>
              <input
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
              />
              <button onClick={joinGame} className={styles.primaryBtn}>
                Join Room
              </button>
            </div>

            <div className={styles.optionCard}>
              <h3>Find Player</h3>
              <p>Search by Player ID</p>
              <input
                type="text"
                placeholder="Player ID (e.g. #ABC123)"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPlayer()}
              />
              <button onClick={searchPlayer} className={styles.primaryBtn}>
                Search Player
              </button>
            </div>
          </div>

          {/* Chat Section */}
          <div className={styles.chatSection}>
            <div className={styles.chatHeader}>
              <span>Global Chat</span>
              <div className={styles.playerIdMini}>
                <span>ID: </span>
                <strong>{myPlayerId}</strong>
                <button onClick={copyPlayerId} className={styles.copyBtnMini}>
                  📋
                </button>
              </div>
            </div>
            <div className={styles.chatMessages} ref={chatRef}>
              {chatMessages.length === 0 ? (
                <div className={styles.emptyChat}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.chatMessage} ${msg.userId === user.uid ? styles.own : styles.other}`}
                  >
                    {msg.userId !== user.uid && (
                      <div className={styles.messageSender}>{msg.userName}</div>
                    )}
                    <div className={styles.messageContent}>
                      <div
                        className={styles.messageText}
                        dangerouslySetInnerHTML={{
                          __html: escapeHtml(msg.text),
                        }}
                      />
                      {msg.userId === user.uid && (
                        <button
                          className={styles.messageMenu}
                          onClick={() => deleteMessage(msg.id)}
                        >
                          ⋯
                        </button>
                      )}
                    </div>
                    <div className={styles.messageTime}>
                      {msg.timestamp
                        ? new Date(msg.timestamp.toDate()).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : "now"}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.chatInputContainer}>
              <input
                type="text"
                placeholder="Type a message..."
                maxLength={200}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage} className={styles.sendBtn}>
                Send
              </button>
            </div>
          </div>

          {/* Social Section */}
          <div className={styles.socialSection}>
            <div className={styles.socialTabs}>
              <button
                className={`${styles.socialTab} ${activeTab === "players" ? styles.active : ""}`}
                onClick={() => setActiveTab("players")}
              >
                Online Players
              </button>
              <button
                className={`${styles.socialTab} ${activeTab === "friends" ? styles.active : ""}`}
                onClick={() => setActiveTab("friends")}
              >
                Friends
              </button>
              <button
                className={`${styles.socialTab} ${activeTab === "requests" ? styles.active : ""}`}
                onClick={() => setActiveTab("requests")}
              >
                Friend Requests
              </button>
            </div>

            {activeTab === "players" && (
              <div className={styles.tabContent}>
                {players.map((player) => (
                  <div key={player.id} className={styles.playerItem}>
                    <div>
                      <div className={styles.playerName}>{player.name}</div>
                      <div className={styles.playerStatus}>
                        Online • ID: #{player.playerId || "N/A"}
                      </div>
                    </div>
                    <div>
                      <button
                        className={styles.inviteBtn}
                        onClick={() =>
                          sendGameInvite(player.id, player.name)
                        }
                      >
                        Invite to Play
                      </button>
                      {friendshipStatuses[player.id] === "none" && (
                        <button
                          className={styles.friendBtn}
                          onClick={() =>
                            sendFriendRequest(player.id, player.name)
                          }
                        >
                          Add Friend
                        </button>
                      )}
                      {friendshipStatuses[player.id] === "pending-sent" && (
                        <button className={`${styles.friendBtn} ${styles.pending}`} disabled>
                          Request Sent
                        </button>
                      )}
                      {friendshipStatuses[player.id] === "pending-received" && (
                        <button
                          className={styles.friendBtn}
                          onClick={() =>
                            acceptFriendRequestById(player.id)
                          }
                        >
                          Accept
                        </button>
                      )}
                      {friendshipStatuses[player.id] === "friends" && (
                        <button className={styles.friendBtn} disabled>
                          Friends
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "friends" && (
              <div className={styles.tabContent}>
                {friends.map((friend) => (
                  <div key={friend.id} className={styles.playerItem}>
                    <div>
                      <div className={styles.playerName}>{friend.name}</div>
                      <div className={styles.playerStatus}>Friend</div>
                    </div>
                    <div>
                      <button
                        className={styles.inviteBtn}
                        onClick={() =>
                          sendGameInvite(friend.id, friend.name)
                        }
                      >
                        Invite to Play
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "requests" && (
              <div className={styles.tabContent}>
                {friendRequests.map((req) => (
                  <div key={req.id} className={styles.playerItem}>
                    <div>
                      <div className={styles.playerName}>
                        {req.requesterName}
                      </div>
                      <div className={styles.playerStatus}>
                        wants to be friends
                      </div>
                    </div>
                    <div>
                      <button
                        className={styles.acceptBtn}
                        onClick={() => acceptFriendRequestById(req.id)}
                      >
                        Accept
                      </button>
                      <button
                        className={styles.declineBtn}
                        onClick={() => declineFriendRequest(req.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Game Invitations */}
          <div className={styles.gameInvites}>
            <h3>Game Invitations</h3>
            <div className={styles.invitesList}>
              {invites.map((invite) => (
                <div key={invite.id} className={styles.inviteItem}>
                  <div>
                    <div className={styles.playerName}>
                      {invite.fromUserName}
                    </div>
                    <div className={styles.playerStatus}>
                      wants to play chess
                    </div>
                  </div>
                  <div>
                    <button
                      className={styles.acceptBtn}
                      onClick={() => acceptInvite(invite.id)}
                    >
                      Accept
                    </button>
                    <button
                      className={styles.declineBtn}
                      onClick={() => declineInvite(invite.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

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
import { useToast } from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";
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
  const toast = useToast();

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
  const [createdRoomCode, setCreatedRoomCode] = useState(null);
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const chatRef = useRef(null);
  const seenInviteIds = useRef(new Set());
  const seenNotifIds = useRef(new Set());

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "default",
    onConfirm: () => {},
  });

  function showConfirm(opts) {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title: opts.title || "Confirm",
        message: opts.message || "",
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        variant: opts.variant || "default",
        onConfirm: () => {
          setConfirmModal((p) => ({ ...p, isOpen: false }));
          resolve(true);
        },
      });
    });
  }

  function closeConfirm() {
    setConfirmModal((p) => ({ ...p, isOpen: false }));
  }

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

    const invitesQ = query(
      collection(db, "gameInvites"),
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsubInvites = onSnapshot(invitesQ, (snapshot) => {
      const inviteList = [];
      let newCount = 0;
      snapshot.forEach((d) => {
        inviteList.push({ id: d.id, ...d.data() });
        if (!seenInviteIds.current.has(d.id)) {
          seenInviteIds.current.add(d.id);
          newCount++;
        }
      });
      setInvites(inviteList);
      if (newCount > 0) {
        toast.info(`You have ${newCount} new game invitation${newCount > 1 ? "s" : ""}!`);
      }
    });

    const notifQ = query(
      collection(db, "gameNotifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsubNotifs = onSnapshot(notifQ, (snapshot) => {
      snapshot.forEach(async (d) => {
        if (seenNotifIds.current.has(d.id)) return;
        seenNotifIds.current.add(d.id);
        const notification = d.data();
        if (
          notification.type === "gameReady" ||
          notification.type === "quickMatchFound"
        ) {
          await updateDoc(doc(db, "gameNotifications", d.id), { read: true });
          const confirmed = await showConfirm({
            title: "🎮 Game Ready!",
            message: notification.message,
            confirmText: "Join Game",
            cancelText: "Later",
            variant: "success",
          });
          if (confirmed) {
            router.push(`/game/${notification.gameRoomId}`);
          }
        }
      });
    });

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
  }, [user, updateUserOnlineStatus, getFriendshipStatus, router, toast]);

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
      toast.error("Failed to send message. Please try again.");
    }
  }

  async function deleteMessage(messageId) {
    const confirmed = await showConfirm({
      title: "Delete Message",
      message: "Are you sure you want to delete this message?",
      confirmText: "Delete",
      variant: "danger",
    });
    if (confirmed) {
      try {
        await deleteDoc(doc(db, "globalChat", messageId));
        toast.success("Message deleted");
      } catch (error) {
        toast.error("Failed to delete message");
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
      toast.success(`Invitation sent to ${toUserName}!`);
    } catch (error) {
      toast.error("Failed to send invitation. Please try again.");
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

      toast.success("Game started! Redirecting...");
      router.push(`/game/${gameRoom.id}`);
    } catch (error) {
      toast.error("Failed to accept invitation. Please try again.");
    }
  }

  async function declineInvite(inviteId) {
    try {
      await updateDoc(doc(db, "gameInvites", inviteId), { status: "declined" });
      toast.info("Invitation declined");
    } catch (error) {
      toast.error("Failed to decline invitation");
    }
  }

  async function findQuickMatch() {
    try {
      setIsSearching(true);
      toast.info("Searching for an opponent...");

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

        toast.success("Opponent found! Starting game...");
        router.push(`/game/${gameRoom.id}`);
      } else {
        await addDoc(collection(db, "matchmaking"), {
          userId: user.uid,
          userName: user.displayName || user.email,
          status: "waiting",
          createdAt: serverTimestamp(),
        });
        toast.info("Added to matchmaking queue. Waiting for an opponent...");
      }
    } catch (error) {
      toast.error("Matchmaking failed. Please try again.");
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
      toast.info("Search cancelled");
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
      setCreatedRoomCode(code);
      setCreatedRoomId(gameRoom.id);
      toast.success(`Room created successfully!`);
    } catch (error) {
      toast.error("Failed to create game room. Please try again.");
    }
  }

  async function joinGame() {
    if (!roomCode.trim()) {
      toast.warning("Please enter a room code");
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
        toast.error("Game room not found or already full");
        return;
      }

      await updateDoc(doc(db, "gameRooms", found.id), {
        player2: { uid: user.uid, name: user.displayName || user.email, color: "black" },
        status: "active",
        gameStartedAt: serverTimestamp(),
      });

      toast.success("Joined game! Starting...");
      router.push(`/game/${found.id}`);
    } catch (error) {
      toast.error("Failed to join game. Please try again.");
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
        toast.warning("Friend request already sent or you're already friends!");
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
      toast.success(`Friend request sent to ${toUserName}!`);
    } catch (error) {
      toast.error("Failed to send friend request. Please try again.");
    }
  }

  async function acceptFriendRequestById(requestId) {
    try {
      const reqDoc = await getDoc(doc(db, "friendships", requestId));
      if (!reqDoc.exists() || reqDoc.data().status !== "pending") {
        toast.warning("This friend request is no longer valid");
        return;
      }
      await updateDoc(doc(db, "friendships", requestId), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
      toast.success("Friend request accepted!");
    } catch (error) {
      toast.error("Failed to accept friend request");
    }
  }

  async function declineFriendRequest(requestId) {
    try {
      await deleteDoc(doc(db, "friendships", requestId));
      toast.info("Friend request declined");
    } catch (error) {
      toast.error("Failed to decline friend request");
    }
  }

  async function searchPlayer() {
    const playerId = playerSearch.trim().replace("#", "").toUpperCase();
    if (!playerId) {
      toast.warning("Please enter a Player ID");
      return;
    }
    try {
      const q = query(
        collection(db, "users"),
        where("playerId", "==", playerId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast.error("Player not found. Double-check the Player ID.");
        return;
      }
      const playerDoc = snapshot.docs[0];
      const playerData = playerDoc.data();
      const playerUid = playerDoc.id;

      if (playerUid === user.uid) {
        toast.info("That's your own Player ID!");
        return;
      }

      const status = await getFriendshipStatus(playerUid);

      if (status === "friends") {
        const confirmed = await showConfirm({
          title: `Player Found: ${playerData.name}`,
          message: `You are already friends!\nWould you like to invite them to a game?`,
          confirmText: "Send Invite",
          variant: "success",
        });
        if (confirmed) await sendGameInvite(playerUid, playerData.name);
      } else if (status === "pending-sent") {
        const confirmed = await showConfirm({
          title: `Player Found: ${playerData.name}`,
          message: `Friend request already sent.\nWould you like to invite them to a game?`,
          confirmText: "Send Invite",
        });
        if (confirmed) await sendGameInvite(playerUid, playerData.name);
      } else if (status === "pending-received") {
        toast.info(`${playerData.name} already sent you a friend request! Check your Friend Requests tab.`);
      } else {
        const confirmed = await showConfirm({
          title: `Player Found: ${playerData.name}`,
          message: `Player ID: #${playerData.playerId}\n\nWould you like to send a friend request?`,
          confirmText: "Add Friend",
          cancelText: "Send Game Invite",
          variant: "success",
        });
        if (confirmed) {
          await sendFriendRequest(playerUid, playerData.name);
        } else {
          await sendGameInvite(playerUid, playerData.name);
        }
      }
      setPlayerSearch("");
    } catch (error) {
      toast.error("Search failed. Please try again.");
    }
  }

  function copyPlayerId() {
    navigator.clipboard.writeText(myPlayerId).then(() => {
      toast.success("Player ID copied to clipboard!");
    }).catch(() => {
      toast.info(`Your Player ID is: ${myPlayerId}`);
    });
  }

  async function handleLogout() {
    const confirmed = await showConfirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmText: "Logout",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await updateUserOnlineStatus(false);
      await signOut(auth);
      router.push("/auth");
    } catch (error) {
      toast.error("Logout failed. Please try again.");
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
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

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
                <button key="cancel-search" onClick={cancelQuickMatch} className={styles.primaryBtn}>
                  Cancel Search
                </button>
              ) : (
                <button key="find-match" onClick={findQuickMatch} className={styles.primaryBtn}>
                  Find Match
                </button>
              )}
            </div>

            <div className={styles.optionCard}>
              <h3>Create Game</h3>
              <p>Create a room and invite friends</p>
              {createdRoomCode ? (
                <div key="room-info" className={styles.createdRoomInfo}>
                  <div className={styles.roomCodeDisplay}>
                    <span>Code: </span>
                    <strong>{createdRoomCode}</strong>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(createdRoomCode);
                        toast.success("Room code copied!");
                      }}
                      className={styles.copyBtnMini}
                      title="Copy Room Code"
                    >
                      📋
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button 
                      onClick={() => router.push(`/game/${createdRoomId}`)} 
                      className={styles.primaryBtn}
                      style={{ flex: 1 }}
                    >
                      Enter Room
                    </button>
                    <button 
                      onClick={() => {
                        setCreatedRoomCode(null);
                        setCreatedRoomId(null);
                      }} 
                      className={styles.secondaryBtn}
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', color: 'inherit' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <button key="create-btn" onClick={createGame} className={styles.primaryBtn}>
                  Create Room
                </button>
              )}
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
                        ? new Date(msg.timestamp.toDate()).toLocaleDateString(
                            [],
                            { month: "short", day: "numeric" }
                          ) +
                          ", " +
                          new Date(msg.timestamp.toDate()).toLocaleTimeString(
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
                {players.length === 0 ? (
                  <div className={styles.emptyChat}>No other players online</div>
                ) : (
                  players.map((player) => (
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
                  ))
                )}
              </div>
            )}

            {activeTab === "friends" && (
              <div className={styles.tabContent}>
                {friends.length === 0 ? (
                  <div className={styles.emptyChat}>No friends yet. Add some!</div>
                ) : (
                  friends.map((friend) => (
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
                  ))
                )}
              </div>
            )}

            {activeTab === "requests" && (
              <div className={styles.tabContent}>
                {friendRequests.length === 0 ? (
                  <div className={styles.emptyChat}>No pending requests</div>
                ) : (
                  friendRequests.map((req) => (
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
                  ))
                )}
              </div>
            )}
          </div>

          {/* Game Invitations */}
          <div className={styles.gameInvites}>
            <h3>Game Invitations</h3>
            <div className={styles.invitesList}>
              {invites.length === 0 ? (
                <div className={styles.emptyChat}>No pending invitations</div>
              ) : (
                invites.map((invite) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

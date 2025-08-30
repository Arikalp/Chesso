// Remove the require statement - it's not needed in browser
// const { render } = require("ejs");

console.log("Chess Game Initialized!");

let currentUser = null;
let gameRoomId = null;
var chess = new Chess();
let gameStartTime = null;
let timerInterval = null;
const boardElement = document.querySelector(".chessboard");
let draggedPiece = null;
let sourceSquare = null;
let PlayerRole = null;

// Get room ID from URL
gameRoomId = window.location.pathname.split('/').pop();

// Check authentication
auth.onAuthStateChanged((user) => {
  if (!user) {
    console.log('No user authenticated, redirecting to auth');
    window.location.href = '/auth';
    return;
  }
  
  currentUser = user;
  console.log('User authenticated:', user.displayName || user.email);
  
  // Update user display elements
  const userNameElement = document.getElementById('user-name');
  const currentPlayerElement = document.getElementById('current-player-name');
  
  if (userNameElement) userNameElement.textContent = user.displayName || user.email;
  if (currentPlayerElement) currentPlayerElement.textContent = user.displayName || user.email;
  
  // Listen for game room updates (Firebase only, no Socket.IO)
  listenForGameUpdates();
});

function listenForGameUpdates() {
  if (!gameRoomId) {
    console.error('No game room ID found');
    return;
  }
  
  console.log('Listening for updates on room:', gameRoomId);
  
  db.collection('gameRooms').doc(gameRoomId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const gameData = doc.data();
        console.log('=== SNAPSHOT UPDATE ===');
        console.log('Game data received:', gameData);
        console.log('Current user:', currentUser.uid);
        console.log('Player1:', gameData.player1);
        console.log('Player2:', gameData.player2);
        console.log('======================');
        
        // Load board state first
        if (gameData.fen) {
          chess.load(gameData.fen);
        }
        
        // Then update UI with a small delay to ensure DOM is ready
        setTimeout(() => {
          updateGameUI(gameData);
        }, 100);
      } else {
        console.error('Game room not found:', gameRoomId);
        alert('Game room not found!');
        window.location.href = '/lobby';
      }
    }, (error) => {
      console.error('Error listening to game updates:', error);
    });
}

function updateGameUI(gameData) {
  console.log('Updating game UI with data:', gameData);
  console.log('Current user UID:', currentUser.uid);
  
  // Start timer if game is active and not already started
  if (gameData.status === 'active' && gameData.player1 && gameData.player2 && !gameStartTime) {
    startGameTimer(gameData.gameStartedAt || gameData.createdAt);
  }
  
  const opponentElement = document.getElementById('opponent-name');
  const opponentStatus = document.getElementById('opponent-status');
  const turnDisplay = document.getElementById('turn-display');
  const gameStatus = document.getElementById('game-status');
  const playerRoleElement = document.getElementById('player-role');
  
  // Check if elements exist
  if (!opponentElement || !opponentStatus || !turnDisplay || !gameStatus || !playerRoleElement) {
    console.error('Some UI elements not found');
    return;
  }
  
  // Determine player role and opponent
  if (gameData.player1 && gameData.player1.uid === currentUser.uid) {
    PlayerRole = gameData.player1.color;
    console.log('Current user is player1:', PlayerRole);
    
    if (gameData.player2 && gameData.player2.uid && gameData.status === 'active') {
      opponentElement.textContent = gameData.player2.name || 'Player 2';
      opponentStatus.textContent = 'Connected';
      console.log('Player1 sees opponent:', gameData.player2.name);
    } else {
      opponentElement.textContent = 'Waiting for opponent...';
      opponentStatus.textContent = 'Connecting';
      console.log('Player1 waiting for opponent');
    }
  } else if (gameData.player2 && gameData.player2.uid === currentUser.uid) {
    PlayerRole = gameData.player2.color;
    console.log('Current user is player2:', PlayerRole);
    
    if (gameData.player1 && gameData.player1.uid && gameData.status === 'active') {
      opponentElement.textContent = gameData.player1.name || 'Player 1';
      opponentStatus.textContent = 'Connected';
      console.log('Player2 sees opponent:', gameData.player1.name);
    } else {
      opponentElement.textContent = 'Connecting to opponent...';
      opponentStatus.textContent = 'Connecting';
      console.log('Player2 connecting to player1');
    }
  } else {
    // User is spectator or not in this game
    PlayerRole = 'spectator';
    opponentElement.textContent = 'Spectating';
    opponentStatus.textContent = 'Observer';
    console.log('User is spectator or not in game');
  }
  
  // Update turn indicator
  try {
    const currentTurn = chess && chess.turn ? (chess.turn() === 'w' ? 'White' : 'Black') : 'White';
    turnDisplay.textContent = `${currentTurn} to move`;
  } catch (error) {
    turnDisplay.textContent = 'White to move';
  }
  
  // Update game status
  try {
    if (chess && chess.isCheckmate && chess.isCheckmate()) {
      gameStatus.textContent = 'Checkmate!';
    } else if (chess && chess.isCheck && chess.isCheck()) {
      gameStatus.textContent = 'Check!';
    } else if (chess && chess.isDraw && chess.isDraw()) {
      gameStatus.textContent = 'Draw';
    } else if (gameData.status === 'active' && gameData.player1 && gameData.player2) {
      gameStatus.textContent = 'Ready to Play';
    } else {
      gameStatus.textContent = 'Waiting for players';
    }
  } catch (error) {
    console.log('Chess status check error (normal on first load):', error.message);
    if (gameData.status === 'active' && gameData.player1 && gameData.player2) {
      gameStatus.textContent = 'Ready to Play';
    } else {
      gameStatus.textContent = 'Waiting for players';
    }
  }
  
  // Update player role display
  if (PlayerRole) {
    playerRoleElement.textContent = `Playing as ${PlayerRole}`;
    console.log('Player role set to:', PlayerRole);
  }
  
  // Re-render board with updated role
  renderBoard();
}

// No Socket.IO needed - using Firebase Firestore for real-time updates

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = ""; // Clear the board

  // Determine board orientation based on player role
  const isBlackPlayer = PlayerRole === "black";
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement("div");
      
      // Calculate actual board position (rotated for black player)
      const actualRow = isBlackPlayer ? 7 - row : row;
      const actualCol = isBlackPlayer ? 7 - col : col;
      
      square.classList.add(
        "square",
        (actualRow + actualCol) % 2 === 0 ? "light" : "dark"
      );
      square.dataset.row = actualRow;
      square.dataset.col = actualCol;

      const piece = board[actualRow][actualCol];
      if (piece) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          piece.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(piece.type, piece.color);
        
        // Set draggable based on player role
        const isPlayerPiece = (piece.color === "w" && PlayerRole === "white") || 
                             (piece.color === "b" && PlayerRole === "black");
        pieceElement.draggable = isPlayerPiece && PlayerRole !== 'spectator';
        
        console.log(`Piece ${piece.type} (${piece.color}) - draggable: ${pieceElement.draggable}, PlayerRole: ${PlayerRole}`);

        pieceElement.addEventListener("dragstart", (e) => {
          console.log("Drag start on piece:", pieceElement.innerText);
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = { row: actualRow, col: actualCol };
            e.dataTransfer.setData("text/plain", pieceElement.innerText);
            e.dataTransfer.effectAllowed = "move";
          }
        });

        pieceElement.addEventListener("dragend", (e) => {
          console.log("Drag end");
          draggedPiece = null;
          sourceSquare = null;
        });

        square.appendChild(pieceElement);
      }

      square.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });

      square.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (draggedPiece) {
          square.style.backgroundColor = "#FFD700";
        }
      });

      square.addEventListener("dragleave", (e) => {
        e.preventDefault();
        square.style.backgroundColor = "";
      });

      square.addEventListener("drop", (e) => {
        e.preventDefault();
        square.style.backgroundColor = "";
        
        if (draggedPiece && sourceSquare) {
          const targetRow = parseInt(square.dataset.row);
          const targetCol = parseInt(square.dataset.col);
          
          console.log(`Attempting move from ${sourceSquare.row},${sourceSquare.col} to ${targetRow},${targetCol}`);
          
          // Convert to chess notation (always use standard notation regardless of board orientation)
          const fromSquare = `${String.fromCharCode(97 + sourceSquare.col)}${8 - sourceSquare.row}`;
          const toSquare = `${String.fromCharCode(97 + targetCol)}${8 - targetRow}`;
          
          const move = {
            from: fromSquare,
            to: toSquare
          };

          console.log("Sending move:", move);
          
          // Send move to server and update Firestore
          makeMove(move);
          
          draggedPiece = null;
          sourceSquare = null;
        }
      });

      boardElement.appendChild(square);
    }
  }
};

// Update getPieceUnicode to accept type and color
const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    p: color === "w" ? "♙" : "♟",
    r: color === "w" ? "♖" : "♜",
    n: color === "w" ? "♘" : "♞",
    b: color === "w" ? "♗" : "♝",
    q: color === "w" ? "♕" : "♛",
    k: color === "w" ? "♔" : "♚",
  };
  return unicodePieces[type] || "";
};

async function makeMove(move) {
  try {
    console.log('Attempting move:', move, 'Player role:', PlayerRole, 'Current turn:', chess.turn());
    
    // Validate move locally first
    const testChess = new Chess(chess.fen());
    const result = testChess.move(move);
    
    if (!result) {
      console.log('Invalid move attempted');
      alert('Invalid move!');
      return;
    }
    
    // Check if it's player's turn
    const isPlayerTurn = (chess.turn() === 'w' && PlayerRole === 'white') || 
                        (chess.turn() === 'b' && PlayerRole === 'black');
    
    if (!isPlayerTurn) {
      console.log('Not player turn. Current turn:', chess.turn(), 'Player role:', PlayerRole);
      alert("It's not your turn!");
      return;
    }
    
    console.log('Move is valid, updating Firestore...');
    
    // Update game in Firestore
    await db.collection('gameRooms').doc(gameRoomId).update({
      fen: testChess.fen(),
      lastMove: move,
      lastMoveBy: currentUser.uid,
      lastMoveAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Move sent successfully:', move);
  } catch (error) {
    console.error('Error making move:', error);
    alert('Failed to make move: ' + error.message);
  }
}

function startGameTimer(createdAt) {
  if (createdAt && createdAt.toDate) {
    gameStartTime = createdAt.toDate();
  } else {
    gameStartTime = new Date();
  }
  
  // Clear any existing timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Update timer every second
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer(); // Update immediately
}

function updateTimer() {
  if (!gameStartTime) return;
  
  const now = new Date();
  const elapsed = Math.floor((now - gameStartTime) / 1000);
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  const timerElement = document.getElementById('game-timer');
  if (timerElement) {
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function goToLobby() {
  // Clear timer when leaving game
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  window.location.href = '/lobby';
}



// Initialize the game when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderBoard();
  });
} else {
  renderBoard();
}

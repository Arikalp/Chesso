// Remove the require statement - it's not needed in browser
// const { render } = require("ejs");

console.log("Chess Game Initialized!");

const socket = io();
var chess = new Chess();
const boardElement = document.querySelector(".chessboard");
let draggedPiece = null;
let sourceSquare = null;
let PlayerRole = null;

// Connection events
socket.on("connect", () => {
  console.log("Connected to server with ID:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

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
        pieceElement.draggable = isPlayerPiece;
        
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
          
          // Send move to server
          socket.emit("move", move);
          
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

socket.on("PlayerRole", (role) => {
  PlayerRole = role;  
  console.log("Assigned role:", role);
  
  // Update player info display
  const playerInfoElement = document.getElementById("player-role");
  if (role === "spectator") {
    playerInfoElement.textContent = "Spectator Mode";
  } else {
    const orientation = role === "black" ? "Black (Bottom)" : "White (Top)";
    playerInfoElement.textContent = `Playing as ${role} - Board oriented for ${orientation}`;
  }
  
  renderBoard(); // Re-render the board with the new role
});

socket.on("spectator", () => {
  PlayerRole = null;  
  console.log("You are a spectator.");
  
  // Update player info display
  const playerInfoElement = document.getElementById("player-role");
  playerInfoElement.textContent = "Spectator Mode";
  
  renderBoard(); // Re-render the board for spectators
});

socket.on("boardState", (fen) => {
  chess.load(fen); // Load the board state from FEN
  renderBoard(); // Re-render the board with the new state
});

socket.on("move", (move) => {
  try {
    console.log("Received move from server:", move);
    const result = chess.move(move);
    console.log("Applied move result:", result);
    renderBoard(); // Re-render the board after the move
  } catch (error) {
    console.error("Error applying move:", error);
  }
});

socket.on("error", (message) => {
  console.error("Server error:", message);
  alert(message);
});

// Call renderBoard to display the board
renderBoard();

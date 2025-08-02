//  Create Express app instance
//  Initialize HTTP server with Express
//  Instantiate Socket.io on HTTP server

const express = require("express");
const app = express();
const http = require("http");
const socketIo = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");

// Create HTTP server and bind Socket.io
const server = http.createServer(app);
const io = socketIo(server);

// Create Chess object instance (chess.js)
const chess = new Chess();

// Track connected players and current turn
let players = {};
let currPlayer = "white";

// Configure Express app
// Set EJS as templating engine
app.set("view engine", "ejs");
// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "/public")));

// Render index page on root route
app.get("/", (req, res) => {
  res.render("index");
});

// Handle Socket.io connections
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  // Assign player roles: white, black, or spectator
  if (!players.white) {
    players.white = socket.id;
    socket.emit("PlayerRole", "white");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("PlayerRole", "black");
  } else {
    socket.emit("PlayerRole", "spectator");
  }

  // Handle player disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected: " + socket.id);
    if (players.white === socket.id) {
      delete players.white;
    } else if (players.black === socket.id) {
      delete players.black;
    }
  });

  // Handle chess moves from clients
  socket.on("move", (move) => {
    console.log("Received move from client:", move);
    
    // Check if it's the correct player's turn
    try {
      if (chess.turn() === "w" && socket.id !== players.white) {
        socket.emit("error", "It's not your turn!");
        return;
      } else if (chess.turn() === "b" && socket.id !== players.black) {
        socket.emit("error", "It's not your turn!");
        return;
      }

      // Validate the move format
      if (!move.from || !move.to) {
        socket.emit("error", "Invalid move format!");
        console.log("Invalid move format:", move);
        return;
      }

      const result = chess.move(move);
      if(result)
      {
        currPlayer = chess.turn();
        console.log("Move successful:", result);
        console.log("Broadcasting move to all clients:", move);
        io.emit("move", move); // Broadcast the move to all clients
        io.emit("boardState", chess.fen()); // Broadcast the current board state  
        console.log("Broadcast completed");
      }
      else{
        socket.emit("error", "Invalid move!");
        console.log("Invalid move attempted:", move);
      }

    } catch (error) {
      console.error("Error processing move:", error);
      socket.emit("error", "An error occurred while processing the move: " + error.message);
      return;
    }
  });
});

// Listen on port 3000
server.listen(3000, () => {
  console.log("Server listening on port 3000");
});

//  Create Express app instance
//  Initialize HTTP server with Express
//  Instantiate Socket.io on HTTP server

const express = require("express");
const app = express();
const path = require("path");

// No Socket.IO needed - using Firebase Firestore for real-time updates
// No server-side chess logic needed - all handled by client



// Configure Express app
// Set EJS as templating engine
app.set("view engine", "ejs");
// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "/public")));

// Routes
app.get("/", (req, res) => {
  res.redirect("/auth");
});

app.get("/auth", (req, res) => {
  res.render("auth");
});

app.get("/lobby", (req, res) => {
  res.render("lobby");
});

app.get("/game/:roomId", (req, res) => {
  res.render("index");
});

// All game logic handled by Firebase Firestore - no server-side game state needed

// Listen on port 3000
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});

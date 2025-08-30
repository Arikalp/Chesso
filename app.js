const express = require("express");
const path = require("path");

const app = express();

// Configure Express app
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

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

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

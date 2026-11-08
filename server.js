require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3005;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  console.log('22')
  res.render("alltag", {
    pageTitle:
      "Alltagsbegleitung Licht und Freude | Fürsorge & Haushaltsnahe Dienstleistungen",
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

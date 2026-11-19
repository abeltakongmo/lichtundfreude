require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const authRoute = require("./routes/authRoute");
const {
  renderAuth,
  requireAdmin,
} = require("./controllers/authController");
const adminRoute = require("./routes/adminRoute");
const { renderAdmin } = require("./controllers/adminController");
const consultationRoute = require("./routes/consultationRoute");
const companyRoute = require("./routes/companyRoute");
const app = express();
const port = process.env.PORT || 3005;
const mongoUri = process.env.MONGODB_URI?.trim();

if (mongoUri) {
  mongoose.connect(mongoUri).catch((error) => {
    console.error("MongoDB connection failed:", error);
  });
} else {
  console.error("MONGODB_URI is not configured; account authentication is unavailable.");
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/auth", authRoute);
app.use("/api/beratung", consultationRoute);
app.use("/api/companies", companyRoute);
app.use("/api/admin", adminRoute);

app.get("/signup", (req, res) => renderAuth(req, res, "signup"));
app.get("/login", (req, res) => renderAuth(req, res, "login"));
app.get("/auth/verify", (req, res) =>
  renderAuth(req, res, "verify", {
    token: typeof req.query.token === "string" ? req.query.token : "",
  })
);
app.get("/admin", requireAdmin, (req, res) =>
  renderAdmin(req, res, "overview")
);
app.get("/admin/companies", requireAdmin, (req, res) =>
  renderAdmin(req, res, "companies")
);
app.get("/admin/companies/new", requireAdmin, (req, res) =>
  renderAdmin(req, res, "company")
);
app.get("/admin/consultations", requireAdmin, (req, res) =>
  renderAdmin(req, res, "consultations")
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
  return res.render("alltag");
});

app.get("/impressum", (req, res) => {
  return res.render("legal", { page: "impressum" });
});

app.get("/agb", (req, res) => {
  return res.render("legal", { page: "agb" });
});

app.get("/datenschutz", (req, res) => {
  return res.render("legal", { page: "datenschutz" });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API-Endpunkt nicht gefunden." });
});

app.use("/api", (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const isInvalidJson = error instanceof SyntaxError && error.status === 400;
  if (!isInvalidJson) {
    console.error("API request failed:", error);
  }

  return res.status(isInvalidJson ? 400 : 500).json({
    error: isInvalidJson
      ? "Die übermittelten Daten sind ungültig."
      : "Ein unerwarteter Serverfehler ist aufgetreten.",
  });
});

app.use("/auth", (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const isInvalidJson = error instanceof SyntaxError && error.status === 400;
  if (!isInvalidJson) {
    console.error("Authentication request failed:", error);
  }

  return res.status(isInvalidJson ? 400 : 500).json({
    error: isInvalidJson
      ? "Die übermittelten Daten sind ungültig."
      : "Ein unerwarteter Fehler ist aufgetreten.",
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

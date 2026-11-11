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
const Company = require("./models/company");

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

app.get("/", async (req, res) => {
  try {
    const companies = await Company.find({ isActive: { $ne: false } })
      .select("name phone email description region city location")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.render("alltag", {
      pageTitle:
        "Alltagsbegleitung Licht und Freude | Fürsorge & Haushaltsnahe Dienstleistungen",
      serverUrl: process.env.SERVER_URL?.trim() || "",
      companies,
      companiesLoadError: false,
    });
  } catch (error) {
    console.error("Public companies could not be loaded:", error);
    return res.status(500).render("alltag", {
      pageTitle:
        "Alltagsbegleitung Licht und Freude | Fürsorge & Haushaltsnahe Dienstleistungen",
      serverUrl: process.env.SERVER_URL?.trim() || "",
      companies: [],
      companiesLoadError: true,
    });
  }
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

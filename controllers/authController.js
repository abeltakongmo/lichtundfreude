const crypto = require("crypto");
const ejs = require("ejs");
const path = require("path");
const User = require("../models/user");
const { hashPassword, verifyPassword } = require("../functions/password");
const sendMail = require("../functions/nodemailer");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sessionCookie = "lf_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const verificationDurationMs = 24 * 60 * 60 * 1000;

function databaseUnavailable(res) {
  if (User.db.readyState === 1) {
    return false;
  }

  res.status(503).json({
    error: "Der Kontodienst ist momentan nicht verfügbar.",
  });
  return true;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readSessionToken(req) {
  const cookies = (req.headers.cookie || "").split(";");
  const session = cookies.find((cookie) =>
    cookie.trim().startsWith(`${sessionCookie}=`)
  );

  return session ? session.trim().slice(sessionCookie.length + 1) : "";
}

function setSessionCookie(res, token) {
  const attributes = [
    `${sessionCookie}=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.floor(sessionDurationMs / 1000)}`,
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearSessionCookie(res) {
  const attributes = [
    `${sessionCookie}=`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  res.setHeader("Set-Cookie", attributes.join("; "));
}

function getServerUrl() {
  const configuredUrl = process.env.SERVER_URL?.trim();
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("Configure SERVER_URL to send email verification links.");
  }

  const url = new URL(
    configuredUrl || `http://localhost:${process.env.PORT || 3005}`
  );
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error("SERVER_URL must use HTTPS in production.");
  }

  return url.origin;
}

function renderAuth(req, res, mode, extra = {}) {
  res.set("Cache-Control", "no-store");
  return res.render("auth", { mode, ...extra });
}

async function signup(req, res) {
  if (databaseUnavailable(res)) {
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;

  if (
    !name ||
    name.length > 120 ||
    !emailPattern.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error: "Bitte geben Sie einen Namen, eine gültige E-Mail-Adresse und ein Passwort mit 12 bis 128 Zeichen ein.",
    });
  }

  let user;
  try {
    const verificationToken = crypto.randomBytes(32).toString("base64url");
    user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpiresAt: new Date(Date.now() + verificationDurationMs),
    });

    const verificationUrl = new URL("/auth/verify", getServerUrl());
    verificationUrl.searchParams.set("token", verificationToken);
    const html = await ejs.renderFile(
      path.join(__dirname, "../email/verifyEmail.ejs"),
      { name, verificationUrl: verificationUrl.toString() }
    );

    await sendMail({
      to: email,
      subject: "Bitte bestätigen Sie Ihre E-Mail-Adresse",
      text: [
        `Hallo ${name},`,
        "",
        "bitte bestätigen Sie Ihre E-Mail-Adresse über diesen Link:",
        verificationUrl.toString(),
        "",
        "Der Link ist 24 Stunden gültig.",
      ].join("\n"),
      html,
    });

    return res.status(202).json({
      message: "Falls die Registrierung möglich ist, erhalten Sie eine E-Mail mit dem Bestätigungslink.",
    });
  } catch (error) {
    if (user) {
      await User.deleteOne({ _id: user._id });
      console.error("Verification email could not be sent:", error);
      return res.status(502).json({
        error: "Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
      });
    }

    if (error.code === 11000) {
      return res.status(202).json({
        message: "Falls die Registrierung möglich ist, erhalten Sie eine E-Mail mit dem Bestätigungslink.",
      });
    }

    console.error("Signup failed:", error);
    return res.status(500).json({
      error: "Die Registrierung ist momentan nicht möglich.",
    });
  }
}

async function login(req, res) {
  if (databaseUnavailable(res)) {
    return;
  }

  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;

  if (
    !emailPattern.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length > 128
  ) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse oder Passwort." });
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = user
      ? await verifyPassword(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        error: "E-Mail-Adresse oder Passwort ist nicht korrekt.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
      });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    user.sessionTokenHash = hashToken(token);
    user.sessionExpiresAt = new Date(Date.now() + sessionDurationMs);
    await user.save();
    setSessionCookie(res, token);

    return res.status(200).json({
      user: { name: user.name, email: user.email, isAdmin: user.isAdmin },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({
      error: "Die Anmeldung ist momentan nicht möglich.",
    });
  }
}

async function verifyEmail(req, res) {
  if (databaseUnavailable(res)) {
    return;
  }

  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token || token.length > 128) {
    return res.status(400).json({
      error: "Der Bestätigungslink ist ungültig oder abgelaufen.",
    });
  }

  try {
    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) {
      return res.status(400).json({
        error: "Der Bestätigungslink ist ungültig oder abgelaufen.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      message: "Ihre E-Mail-Adresse wurde bestätigt. Sie können sich jetzt anmelden.",
    });
  } catch (error) {
    console.error("Email verification failed:", error);
    return res.status(500).json({
      error: "Die E-Mail-Adresse konnte momentan nicht bestätigt werden.",
    });
  }
}

async function currentUser(req, res) {
  if (databaseUnavailable(res)) {
    return;
  }

  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: "Bitte melden Sie sich an." });
  }

  try {
    const user = await User.findOne({
      sessionTokenHash: hashToken(token),
      sessionExpiresAt: { $gt: new Date() },
      emailVerified: true,
    }).select("+sessionTokenHash +sessionExpiresAt");

    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Bitte melden Sie sich an." });
    }

    return res.status(200).json({
      user: { name: user.name, email: user.email, isAdmin: user.isAdmin },
    });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return res.status(500).json({
      error: "Das Konto konnte momentan nicht geladen werden.",
    });
  }
}

async function requireAdmin(req, res, next) {
  if (databaseUnavailable(res)) {
    return;
  }

  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: "Bitte melden Sie sich an." });
  }

  try {
    const user = await User.findOne({
      sessionTokenHash: hashToken(token),
      sessionExpiresAt: { $gt: new Date() },
      emailVerified: true,
    }).select("+sessionTokenHash +sessionExpiresAt");

    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Bitte melden Sie sich an." });
    }

    if (user.isAdmin !== true) {
      return res.status(403).json({
        error: "Sie haben keinen Zugriff auf die Verwaltung.",
      });
    }

    req.authenticatedUser = user;
    return next();
  } catch (error) {
    console.error("Admin authentication failed:", error);
    return res.status(500).json({
      error: "Der Administratorzugang konnte nicht geprüft werden.",
    });
  }
}

async function logout(req, res) {
  const token = readSessionToken(req);
  clearSessionCookie(res);

  if (token && User.db.readyState === 1) {
    try {
      await User.updateOne(
        { sessionTokenHash: hashToken(token) },
        { $unset: { sessionTokenHash: 1, sessionExpiresAt: 1 } }
      );
    } catch (error) {
      console.error("Logout failed:", error);
      return res.status(500).json({
        error: "Die Abmeldung konnte serverseitig nicht abgeschlossen werden.",
      });
    }
  }

  return res.status(200).json({ message: "Sie wurden abgemeldet." });
}

module.exports = {
  renderAuth,
  signup,
  login,
  verifyEmail,
  currentUser,
  requireAdmin,
  logout,
};

const express = require("express");
const {
  signup,
  login,
  verifyEmail,
  currentUser,
  logout,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify", verifyEmail);
router.get("/me", currentUser);
router.post("/logout", logout);

module.exports = router;

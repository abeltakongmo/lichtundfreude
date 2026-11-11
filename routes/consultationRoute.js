const express = require("express");
const { submitConsultation } = require("../controllers/consultationController");

const router = express.Router();

router.post("/", submitConsultation);

module.exports = router;

const express = require("express");
const {
  getCompanies,
  addCompany,
  updateCompany,
} = require("../controllers/companyController");

const router = express.Router();

router.get("/", getCompanies);
router.post("/", addCompany);
router.put("/:id", updateCompany);

module.exports = router;

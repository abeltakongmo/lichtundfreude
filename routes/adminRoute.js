const express = require("express");
const {
  getCompanies,
  createCompany,
  updateCompany,
  setCompanyActive,
  deleteCompany,
  getConsultations,
  updateConsultation,
} = require("../controllers/adminController");
const { requireAdmin } = require("../controllers/authController");

const router = express.Router();

router.use(requireAdmin);
router.get("/companies", getCompanies);
router.post("/companies", createCompany);
router.put("/companies/:id", updateCompany);
router.patch("/companies/:id/status", setCompanyActive);
router.delete("/companies/:id", deleteCompany);
router.get("/consultations", getConsultations);
router.patch("/consultations/:id", updateConsultation);

module.exports = router;

const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");
const Company = require("../models/company");
const Consultation = require("../models/consultation");
const sendMail = require("../functions/nodemailer");
const geocodeAddress = require("../functions/geocodeAddress");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const consultationStatuses = ["new", "in_progress", "completed"];

function renderAdmin(req, res, page) {
  res.set("Cache-Control", "no-store");
  return res.render("admin", { page, admin: req.authenticatedUser });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function getCompanies(req, res) {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : "";
  const toDate = typeof req.query.toDate === "string" ? req.query.toDate : "";
  const location =
    typeof req.query.location === "string" ? req.query.location.trim() : "";
  const radiusKm = req.query.radiusKm === undefined ? 25 : Number(req.query.radiusKm);

  if (
    name.length > 120 ||
    (fromDate && !isValidDate(fromDate)) ||
    (toDate && !isValidDate(toDate)) ||
    (fromDate && toDate && fromDate > toDate) ||
    location.length > 300 ||
    !Number.isFinite(radiusKm) ||
    radiusKm < 1 ||
    radiusKm > 200
  ) {
    return res.status(400).json({ error: "Ungültige Filterangaben." });
  }

  const query = {};
  if (name) {
    query.name = { $regex: escapeRegex(name), $options: "i" };
  }
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      const exclusiveEndDate = new Date(`${toDate}T00:00:00.000Z`);
      exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);
      query.createdAt.$lt = exclusiveEndDate;
    }
  }

  try {
    let companiesQuery;
    if (location) {
      const coordinates = await geocodeAddress(location);
      if (!coordinates) {
        return res.status(400).json({
          error: "Für diesen Ort wurden keine Koordinaten gefunden.",
        });
      }

      companiesQuery = Company.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [coordinates.longitude, coordinates.latitude],
            },
            $maxDistance: radiusKm * 1000,
          },
        },
      }).limit(500);
    } else {
      companiesQuery = Company.find(query).sort({ createdAt: -1 }).limit(500);
    }

    const companies = await companiesQuery.lean();
    return res.status(200).json(
      companies.map((company) => ({
        id: company._id,
        name: company.name,
        phone: company.phone,
        email: company.email,
        description: company.description,
        region: company.region || "",
        city: company.city || "",
        isActive: company.isActive !== false,
        createdAt: company.createdAt,
        location: company.location,
      }))
    );
  } catch (error) {
    console.error("Companies could not be loaded:", error);
    return res.status(location ? 502 : 500).json({
      error: location
        ? "Die Unternehmen konnten anhand des Ortsfilters nicht geladen werden."
        : "Die Unternehmen konnten nicht geladen werden.",
    });
  }
}

async function updateCompany(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Ungültige Unternehmens-ID." });
  }

  const { name, phone, email, description, region, city, address } =
    req.body || {};
  const update = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
      return res.status(400).json({ error: "Bitte geben Sie einen gültigen Namen ein." });
    }
    update.name = name.trim();
  }
  if (phone !== undefined) {
    if (typeof phone !== "string" || !phone.trim() || phone.trim().length > 50) {
      return res.status(400).json({ error: "Bitte geben Sie eine gültige Telefonnummer ein." });
    }
    update.phone = phone.trim();
  }
  if (email !== undefined) {
    if (
      typeof email !== "string" ||
      !emailPattern.test(email.trim()) ||
      email.trim().length > 254
    ) {
      return res.status(400).json({ error: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
    }
    update.email = email.trim().toLowerCase();
  }
  if (description !== undefined) {
    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 2000
    ) {
      return res.status(400).json({ error: "Bitte geben Sie eine gültige Beschreibung ein." });
    }
    update.description = description.trim();
  }
  if (region !== undefined) {
    if (typeof region !== "string" || region.trim().length > 120) {
      return res.status(400).json({ error: "Bitte geben Sie eine gültige Region ein." });
    }
    update.region = region.trim();
  }
  if (city !== undefined) {
    if (typeof city !== "string" || city.trim().length > 120) {
      return res.status(400).json({ error: "Bitte geben Sie eine gültige Stadt ein." });
    }
    update.city = city.trim();
  }
  if (address !== undefined && address !== "") {
    if (typeof address !== "string" || !address.trim() || address.trim().length > 300) {
      return res.status(400).json({ error: "Bitte prüfen Sie die eingegebene Adresse." });
    }

    try {
      const coordinates = await geocodeAddress(address.trim());
      if (!coordinates) {
        return res.status(400).json({
          error: "Für diese Adresse wurden keine Koordinaten gefunden.",
        });
      }
      update.location = {
        type: "Point",
        coordinates: [coordinates.longitude, coordinates.latitude],
      };
    } catch (error) {
      console.error("Company address lookup failed:", error);
      return res.status(502).json({
        error: "Die Adresse konnte gerade nicht geprüft werden.",
      });
    }
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "Es wurden keine Änderungen angegeben." });
  }

  try {
    const company = await Company.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!company) {
      return res.status(404).json({ error: "Unternehmen nicht gefunden." });
    }
    return res.status(200).json({ message: "Unternehmen aktualisiert." });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Company update failed:", error);
    return res.status(500).json({ error: "Das Unternehmen konnte nicht aktualisiert werden." });
  }
}

async function setCompanyActive(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Ungültige Unternehmens-ID." });
  }
  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({ error: "Ungültiger Unternehmensstatus." });
  }

  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true, runValidators: true }
    ).lean();
    if (!company) {
      return res.status(404).json({ error: "Unternehmen nicht gefunden." });
    }
    return res.status(200).json({
      message: req.body.isActive ? "Unternehmen aktiviert." : "Unternehmen pausiert.",
      isActive: req.body.isActive,
    });
  } catch (error) {
    console.error("Company status update failed:", error);
    return res.status(500).json({ error: "Der Unternehmensstatus konnte nicht aktualisiert werden." });
  }
}

async function deleteCompany(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Ungültige Unternehmens-ID." });
  }

  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Unternehmen nicht gefunden." });
    }
    return res.status(200).json({ message: "Unternehmen gelöscht." });
  } catch (error) {
    console.error("Company deletion failed:", error);
    return res.status(500).json({ error: "Das Unternehmen konnte nicht gelöscht werden." });
  }
}

async function createCompany(req, res) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";
  const region =
    typeof req.body?.region === "string" ? req.body.region.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const address =
    typeof req.body?.address === "string" ? req.body.address.trim() : "";

  if (
    !name ||
    name.length > 120 ||
    !phone ||
    phone.length > 50 ||
    !emailPattern.test(email) ||
    email.length > 254 ||
    !description ||
    description.length > 2000 ||
    !region ||
    region.length > 120 ||
    !city ||
    city.length > 120 ||
    !address ||
    address.length > 300
  ) {
    return res.status(400).json({
      error: "Bitte füllen Sie alle Felder mit gültigen Angaben aus.",
    });
  }

  let coordinates;
  try {
    coordinates = await geocodeAddress(address);
  } catch (error) {
    console.error("Company address lookup failed:", error);
    return res.status(502).json({
      error: "Die Adresse konnte gerade nicht geprüft werden. Bitte versuchen Sie es später erneut.",
    });
  }

  if (!coordinates) {
    return res.status(400).json({
      error: "Für diese Adresse wurden keine Koordinaten gefunden. Bitte prüfen Sie die Eingabe.",
    });
  }

  try {
    const company = await Company.create({
      name,
      phone,
      email,
      description,
      region,
      city,
      location: {
        type: "Point",
        coordinates: [coordinates.longitude, coordinates.latitude],
      },
    });

    let emailSent = true;
    try {
      const html = await ejs.renderFile(
        path.join(__dirname, "../email/companyAdded.ejs"),
        { company }
      );
      await sendMail({
        to: company.email,
        subject: `Welcome, ${company.name}`,
        text: `Hello ${company.name}, your company has been added successfully.`,
        html,
      });
    } catch (error) {
      emailSent = false;
      console.error("Company was added, but its notification email failed:", error);
    }

    return res.status(201).json({
      company: {
        id: company.id,
        name: company.name,
        phone: company.phone,
        email: company.email,
        description: company.description,
        location: company.location,
      },
      emailSent,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Company creation failed:", error);
    return res.status(500).json({
      error: "Das Unternehmen konnte nicht gespeichert werden.",
    });
  }
}

async function getConsultations(req, res) {
  try {
    const consultations = await Consultation.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.status(200).json(consultations);
  } catch (error) {
    console.error("Consultations could not be loaded:", error);
    return res.status(500).json({
      error: "Die Beratungsanfragen konnten nicht geladen werden.",
    });
  }
}

async function updateConsultation(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Ungültige Anfrage-ID." });
  }

  const status = req.body?.status;
  if (!consultationStatuses.includes(status)) {
    return res.status(400).json({ error: "Ungültiger Bearbeitungsstatus." });
  }

  try {
    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!consultation) {
      return res.status(404).json({ error: "Beratungsanfrage nicht gefunden." });
    }

    return res.status(200).json(consultation);
  } catch (error) {
    console.error("Consultation update failed:", error);
    return res.status(500).json({
      error: "Der Bearbeitungsstatus konnte nicht gespeichert werden.",
    });
  }
}

module.exports = {
  renderAdmin,
  getCompanies,
  createCompany,
  updateCompany,
  setCompanyActive,
  deleteCompany,
  getConsultations,
  updateConsultation,
};

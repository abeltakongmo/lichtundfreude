const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");
const Company = require("../models/company");
const sendMail = require("../functions/nodemailer");
const geocodeAddress = require("../functions/geocodeAddress");

function distanceBetweenCoordinatesKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return (
    6371.0088 *
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleError(res, error) {
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: error.message });
  }

  console.error("Company request failed:", error);
  return res.status(500).json({ error: "An unexpected error occurred." });
}

async function getCompanies(req, res) {
  try {
    const place =
      typeof req.query.location === "string" ? req.query.location.trim() : "";
    const filter =
      typeof req.query.filter === "string" ? req.query.filter.trim() : "";
    const radiusKm =
      req.query.radiusKm === undefined ? 25 : Number(req.query.radiusKm);

    if (
      place.length > 300 ||
      filter.length > 120 ||
      !Number.isFinite(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 200
    ) {
      return res.status(400).json({ error: "Invalid company filters." });
    }

    const query = { isActive: { $ne: false } };
    let searchCoordinates;
    if (filter) {
      query.$or = ["name", "description"].map((field) => ({
        [field]: { $regex: escapeRegex(filter), $options: "i" },
      }));
    }

    if (place) {
      searchCoordinates = await geocodeAddress(place);
      if (!searchCoordinates) {
        return res.status(400).json({ error: "No coordinates found for that location." });
      }

      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [searchCoordinates.longitude, searchCoordinates.latitude],
          },
          $maxDistance: radiusKm * 1000,
        },
      };
    }

    const companies = await Company.find(query)
      .select("name phone email description region city location createdAt")
      .limit(100)
      .lean();
    const results = searchCoordinates
      ? companies.map((company) => {
          const [longitude, latitude] = company.location.coordinates;
          return {
            ...company,
            distanceKm: distanceBetweenCoordinatesKm(searchCoordinates, {
              latitude,
              longitude,
            }),
          };
        })
      : companies;
    return res.status(200).json(results);
  } catch (error) {
    return handleError(res, error);
  }
}

async function addCompany(req, res) {
  try {
    const company = await Company.create(req.body);

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

      return res.status(201).json({ company, emailSent: true });
    } catch (emailError) {
      console.error(
        "Company was added, but its notification email failed:",
        emailError
      );
      return res.status(201).json({ company, emailSent: false });
    }
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateCompany(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid company ID." });
    }

    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    return res.status(200).json(company);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getCompanies,
  addCompany,
  updateCompany,
  distanceBetweenCoordinatesKm,
};

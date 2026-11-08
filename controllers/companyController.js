const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");
const Company = require("../models/company");
const sendMail = require("../functions/nodemailer");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function distanceBetweenLocations(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const [firstLongitude, firstLatitude] = first.coordinates;
  const [secondLongitude, secondLatitude] = second.coordinates;
  const latitudeDifference = radians(secondLatitude - firstLatitude);
  const longitudeDifference = radians(secondLongitude - firstLongitude);
  const haversine = Math.min(
    1,
    Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(radians(firstLatitude)) *
        Math.cos(radians(secondLatitude)) *
        Math.sin(longitudeDifference / 2) ** 2
  );

  return 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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
    const filter = req.query.filter?.trim();
    const hasLatitude = req.query.latitude !== undefined;
    const hasLongitude = req.query.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        error: "Provide both latitude and longitude to sort by distance.",
      });
    }

    let location;
    if (hasLatitude) {
      const latitude = Number(req.query.latitude);
      const longitude = Number(req.query.longitude);

      if (
        req.query.latitude === "" ||
        req.query.longitude === "" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res
          .status(400)
          .json({ error: "Invalid latitude or longitude." });
      }

      location = { type: "Point", coordinates: [longitude, latitude] };
    }

    const query = filter
      ? {
          $or: ["name", "phone", "email", "description"].map((field) => ({
            [field]: { $regex: escapeRegex(filter), $options: "i" },
          })),
        }
      : {};

    const companies = await Company.find(query);
    if (location) {
      companies.sort(
        (first, second) =>
          distanceBetweenLocations(location, first.location) -
          distanceBetweenLocations(location, second.location)
      );
    }

    return res.status(200).json(companies);
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

module.exports = { getCompanies, addCompany, updateCompany };

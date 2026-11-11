const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");
const Consultation = require("../models/consultation");
const sendMail = require("../functions/nodemailer");

const recipient = "info@licht-und-freude.com";
const locations = {
  muenchen: "München",
  memmingen: "Memmingen",
  ingolstadt: "Ingolstadt",
  holzkirchen: "Holzkirchen",
  weitere: "Weitere Region",
};
const careLevels = [
  "Ja, Pflegegrad 1-5",
  "Noch kein Pflegegrad",
  "Privatzahlung / Haushaltsnah",
];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function getOptionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return getText(value, maxLength);
}

async function submitConsultation(req, res) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Der Beratungsdienst ist momentan nicht verfügbar.",
    });
  }

  const name = getText(req.body?.name, 120);
  const phone = getText(req.body?.phone, 50);
  const location = getText(req.body?.location, 30);
  const careLevel = getText(req.body?.careLevel, 60);
  const message = getOptionalText(req.body?.message, 2000);
  const email = getOptionalText(req.body?.email, 254);

  if (
    !name ||
    !phone ||
    !location ||
    !locations[location] ||
    !careLevel ||
    !careLevels.includes(careLevel) ||
    message === null ||
    email === null ||
    (email && !emailPattern.test(email))
  ) {
    return res.status(400).json({ error: "Bitte überprüfen Sie Ihre Angaben." });
  }

  try {
    const consultation = {
      name,
      phone,
      location: locations[location],
      careLevel,
      message,
      email,
    };
    const savedConsultation = await Consultation.create(consultation);
    const text = [
      "Neue Anfrage für eine kostenlose Beratung",
      "",
      `Name: ${name}`,
      `Telefon: ${phone}`,
      `E-Mail: ${email || "Nicht angegeben"}`,
      `Gewünschter Standort: ${locations[location]}`,
      `Pflegegrad: ${careLevel}`,
      `Nachricht: ${message || "Keine Nachricht angegeben"}`,
    ].join("\n");

    let emailSent = true;
    try {
      const html = await ejs.renderFile(
        path.join(__dirname, "../email/consultationRequest.ejs"),
        { consultation }
      );
      await sendMail({
        to: recipient,
        subject: "Neue Anfrage für eine kostenlose Beratung",
        text,
        html,
        ...(email ? { replyTo: email } : {}),
      });
    } catch (emailError) {
      emailSent = false;
      console.error(
        `Consultation ${savedConsultation.id} was saved, but its notification email failed:`,
        emailError
      );
    }

    return res.status(201).json({
      message: "Ihre Beratungsanfrage wurde aufgenommen.",
      emailSent,
    });
  } catch (error) {
    console.error("Consultation request could not be saved:", error);
    return res
      .status(500)
      .json({ error: "Ihre Beratungsanfrage konnte nicht gespeichert werden." });
  }
}

module.exports = { submitConsultation };

require("dotenv").config();

const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } =
    process.env;
  const port = Number(SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !Number.isInteger(port)) {
    throw new Error(
      "Configure SMTP_HOST, SMTP_USER, SMTP_PASS, and a valid SMTP_PORT."
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: SMTP_SECURE === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

async function sendMail({ to, subject, text, html, from, replyTo } = {}) {
  if (!to || !subject || (!text && !html)) {
    throw new Error("Provide a recipient, subject, and text or HTML message.");
  }

  return getTransporter().sendMail({
    from: from || process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    replyTo,
  });
}

module.exports = sendMail;

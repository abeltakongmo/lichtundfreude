const mongoose = require("mongoose");

const consultationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      default: "",
    },
    location: {
      type: String,
      required: true,
      enum: ["München", "Memmingen", "Ingolstadt", "Holzkirchen", "Weitere Region"],
    },
    careLevel: {
      type: String,
      required: true,
      enum: [
        "Ja, Pflegegrad 1-5",
        "Noch kein Pflegegrad",
        "Privatzahlung / Haushaltsnah",
      ],
    },
    message: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["new", "in_progress", "completed"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Consultation ||
  mongoose.model("Consultation", consultationSchema);

const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) =>
            coordinates.length === 2 &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1]) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message:
            "Location coordinates must be [longitude, latitude] within valid geographic ranges.",
        },
      },
    },
  },
  { timestamps: true }
);

companySchema.index({ location: "2dsphere" });

module.exports =
  mongoose.models.Company || mongoose.model("Company", companySchema);

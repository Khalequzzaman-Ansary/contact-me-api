const mongoose = require("mongoose");
const Counter = require("./Counter");

const contactSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Auto-increment numerical id before saving
contactSchema.pre("save", async function () {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "contactId" },
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true }
    );
    this.id = counter.seq;
  }
});

module.exports = mongoose.model("Contact", contactSchema);

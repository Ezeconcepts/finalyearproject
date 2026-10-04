const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, "please enter a fileName"],
    },
    fileDate: {
      type: String,
      required: [true, "please enter a fileName"],
    },

    size: {
      type: String,
      required: [true, "file size is required"],
    },
    type: {
      type: String,
      enum: ["encrypted", "upload"],
      required: [true, "type is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "user is required"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", FileSchema);

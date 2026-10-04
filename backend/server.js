require("dotenv").config({ path: "./config/.env" });
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const connectDB = require("./config/db");
const fs = require("fs");
const path = require("path");

// Ensure required upload directories exist on startup
["uploads-temp", "encrypted-temp", "cloud"].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, "public", dir), { recursive: true });
});

const app = express();
const zip = require("express-zip");

const users = require("./routes/users");
const files = require("./routes/files");

app.use(cors({ origin: "https://frontend-r6c1.onrender.com" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(fileUpload());

app.use("/api/users", users);
app.use("/api/files", files);

connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use. Try a different PORT in config/.env`);
    } else {
      console.error("❌ Server error:", err.message);
    }
    process.exit(1);
  });
});

app.post("/a", (req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=myFolder.zip");
  res.zip([
    {
      path: "C:\\Users\\OmoKhefue\\Desktop\\tumex\\backend\\controllers/../public/cloud//65fdad4281dc506acad66cb6_1711377267032_2024.txt",
      name: "/65fdad4281dc506acad66cb6_1711377267032_2024.txt",
    },
  ]);
});
process.on("unhandledRejection", (err, promise) => {
  console.log("Unhandled Rejection:", err.message);
  process.exit(1);
});

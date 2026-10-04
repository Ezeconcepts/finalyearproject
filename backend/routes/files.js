const express = require("express");
const {
  encryptFile,
  upload,
  userFiles,
  decryptFile,
  deleteFile,
  userEncryptedFiles,
  fileToCloud,
  getFilesFromCloud,
  downloadFilesFromCloud,
} = require("../controllers/files");

const router = express.Router();

router.post("/encrypt-multiple", encryptFile);
router.post("/download-multiple", downloadFilesFromCloud);

router.delete("/delete-multiple", deleteFile);

router.post("/upload", upload);
router.post("/upload/cloud-multiple", fileToCloud);

router.get("/uploads/:userId", userFiles);
router.get("/encrypted/:userId", userEncryptedFiles);

router.get("/cloud/:user", getFilesFromCloud);

module.exports = router;

// const decrypted = decipher.update(encryptedData, "hex", isBinaryData ? null : "utf8") + decipher.final(isBinaryData ? null : "utf8");

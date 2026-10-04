const File = require("../models/File");
const User = require("../models/User");
const { ensureUserKeys } = require("../utils/userKeys");
const {
  encryptFileHybrid,
  decryptFileHybrid,
  decryptLegacyCbc,
  isHybridFormat,
  unprotectPrivateKey,
} = require("../utils/crypto");
const crypto = require("crypto");
const fs = require("node:fs").promises;
const path = require("path");
const { Storage } = require("@google-cloud/storage");
const archiver = require("archiver");
const JSZip = require("jszip");
const zip = require("express-zip");

const { Dropbox, DropboxAuth } = require("dropbox");
const fetch = require("isomorphic-fetch");

// Returns a fresh Dropbox client with a valid access token
async function getDropbox() {
  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    fetch,
  });
  await auth.refreshAccessToken();
  return new Dropbox({ auth, fetch });
}

// Retries a Dropbox call on transient errors (429 rate-limit / 5xx) with backoff
async function withRetry(fn, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status;
      const transient = status === 429 || (status >= 500 && status < 600);
      if (!transient || attempt === tries - 1) throw error;
      const wait = 2 ** attempt * 500 + Math.floor(Math.random() * 300);
      console.warn(`Dropbox transient error ${status}, retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

exports.encryptFile = async (req, res, next) => {
  const files = req.body;

  try {
    const updatePromises = files.map(async ({ fileDate, fileName }) => {
      const filePath = path.join(
        __dirname,
        "../public/uploads-temp",
        `${fileDate}_${fileName}`
      );
      const inputData = await fs.readFile(filePath);

      // Find the file record so we know which user owns it, then load that
      // user's ECC public key to wrap the per-file AES key against.
      const fileRecord = await File.findOne({
        fileName,
        fileDate,
        type: "upload",
      });
      if (!fileRecord) throw new Error("file record not found");

      const owner = await ensureUserKeys(await User.findById(fileRecord.user).select(
        "+eccPublicKey +eccPrivateKeyEnc"
      ));

      // Hybrid encryption: random AES-256-GCM key per file, wrapped with the
      // owner's secp256k1 public key (ECIES). Output is binary-safe.
      const encryptedBuffer = encryptFileHybrid(inputData, owner.eccPublicKey);

      const uploadPath = `${__dirname}/../public/encrypted-temp/${fileDate}_${fileName}`;

      await fs.writeFile(uploadPath + ".enc", encryptedBuffer);

      await File.findOneAndUpdate(
        { fileName, fileDate, type: "upload" },
        { type: "encrypted" }
      );
      fs.unlink(filePath);
    });

    await Promise.all(updatePromises);
    res.json({ success: "successfully encrypted" });
  } catch (error) {
    console.error("encryptFile error:", error);
    const message =
      error.code === "ENOENT"
        ? "File not found on server. Please re-upload the file and try again."
        : /MASTER_KEY|Account encryption keys|File owner/.test(error.message)
          ? error.message
          : "Error encrypting that... please try again";
    res.json({ error: true, messages: message });
  }
};
exports.fileToCloud = async (req, res) => {
  const { files, user } = req.body;
  try {
    const uploadPromises = files.map(async ({ fileName, fileDate }) => {
      const filePath = path.join(
        __dirname,
        "../public/encrypted-temp",
        `${fileDate}_${fileName}.enc`
      );
      // const fileContent = await fs.readFile(filePath,'base64');
      const fileContent = await fs.readFile(filePath);

      const dropboxPath = `/${user}_${fileDate}_${fileName}`;
      const dropbox = await getDropbox();
      const uploadedFile = await dropbox.filesUpload({
        path: dropboxPath,
        contents: fileContent,
      });

      await File.findOneAndDelete({
        fileName,
        fileDate,
      });
      fs.unlink(
        path.join(
          __dirname,
          "../public/encrypted-temp",
          `${fileDate}_${fileName}.enc`
        )
      );

      return uploadedFile; // Return information about the uploaded file
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.json({ success: true, uploadedFiles });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ error: "Error uploading files" });
  }
};

exports.userFiles = async (req, res) => {
  try {
    const { userId } = req.params;

    const files = await File.find({ user: userId, type: "upload" }).sort({
      createdAt: -1,
    });
    res.json({ files });
  } catch (error) {
    console.error(error);
    res.json({ error: "error getting file" });
  }
};

exports.userEncryptedFiles = async (req, res) => {
  try {
    const { userId } = req.params;

    const files = await File.find({ user: userId, type: "encrypted" }).sort({
      createdAt: -1,
    });

    res.json({ files });
  } catch (error) {
    console.error(error);
    res.json({ error: "error getting file" });
  }
};

exports.deleteFile = async (req, res, next) => {
  const files = req.body;

  try {
    for (const { fileName, fileDate } of files) {
      const filer = await File.findOneAndDelete({
        fileName,
        fileDate,
      });
      fs.unlink(`${__dirname}/../public/uploads-temp/${fileDate}_${fileName}`);
    }

    res.json({ success: true, messages: "files deleted successfully" });
  } catch (error) {
    console.log(error);
    const messages = [];
    if (error.code === 11000) {
      console.log("invalid!");
      messages.push(Object.values(error.keyValue) + " already exists");
    }

    if (error.name === "ValidationError") {
      messages.push(
        Object.values(error.errors).map((err) => ({
          path: err.path,
          message: err.message,
        }))
      );
    }

    res.json({ error: true, messages });
  }
};

function convertBytes(fileSize) {
  const suffixes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let i = 0;
  let readableSize = fileSize;

  while (readableSize >= 1024 && i < suffixes.length - 1) {
    readableSize /= 1024;
    i += 1;
  }

  readableSize = readableSize.toFixed(1); // Round to one decimal place
  return readableSize + " " + suffixes[i];
}

exports.upload = async (req, res) => {
  try {
    let { file: files } = req.files;
    const { id } = req.body;

    if (!Array.isArray(files)) {
      files = [files];
    }

    const uploadedFiles = [];

    for (const file of files) {
      const date = Date.now();
      let uploadPath = `${__dirname}/../public/uploads-temp/${date}_${file.name}`;
      const humanReadableSize = convertBytes(file.size);

      const newFile = await File.create({
        fileName: file.name,
        fileDate: date,
        size: humanReadableSize,
        user: id,
        type: "upload",
      });

      await file.mv(uploadPath);
      uploadedFiles.push(newFile);
    }

    res.json({
      success: "File uploaded successfully",
      uploadedFiles,
    });
  } catch (error) {
    console.log(error);
    res.json({
      error:
        "something went wrong while trying to upload that file. please try again",
    });
  }
};


exports.getFilesFromCloud = async (req, res) => {
  const { user } = req.params;

  try {
    const files = await getAllFiles("");

    const filteredFiles = files.filter((file) => file.name.includes(user));

    const fileNeeded = filteredFiles.map((file) => {
      const parts = file.name.split("_");

      const fileDate = parts[1];
      const fileName = parts.slice(2).join("_");

      const humanReadableSize = convertBytes(file.size);

      return {
        fileName,
        fileDate,
        size: humanReadableSize,
        path: file.path_display,
      };
    });

    res.json({ files: fileNeeded });
  } catch (error) {
    console.error("getFilesFromCloud error:", error);
    if (error?.status === 401) {
      return res.status(401).json({
        error: "Dropbox token has expired. Please update DROPBOX_TOKEN in config/.env",
      });
    }
    res.status(500).json({ error: "Error fetching files from cloud" });
  }
};

async function getAllFiles(path) {
  const dropbox = await getDropbox();
  const files = await dropbox.filesListFolder({ path });
  return files.result.entries;
}

exports.downloadFilesFromCloud = async (req, res) => {
  let paths;
  try {
    paths = JSON.parse(req.query.paths);
  } catch {
    return res.status(400).json({ error: "Invalid download selection. Select cloud files and try again." });
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.some(
    (file) => !file || typeof file.filePath !== "string" || !file.filePath.trim()
  )) {
    return res.status(400).json({ error: "Select cloud files with valid download paths and try again." });
  }

  try {
  // Fetch the Dropbox client once, not once per file, to avoid hammering
  // the token-refresh endpoint (a source of 429 rate-limit errors).
  const dropbox = await getDropbox();

  // Make sure the decryption output folder exists (rules out ENOENT).
  const cloudDir = path.join(__dirname, "../public/cloud");
  await fs.mkdir(cloudDir, { recursive: true });

  const filesToZip = [];
  const failed = [];
  for (const { filePath: dropboxPath } of paths) {
    try {
      const fileDownloaded = await withRetry(() =>
        dropbox.filesDownload({ path: dropboxPath })
      );

      const encryptedData = fileDownloaded.result.fileBinary;
      // Dropbox name format: "{userId}_{fileDate}_{fileName}".
      // userId is a 24-char Mongo ObjectId; slice(39) drops "id_date_".
      const downloadedName = fileDownloaded.result.name;
      const ownerId = downloadedName.slice(0, 24);
      const modifiedFileName = downloadedName.slice(39);

      const uploadPath = path.join(cloudDir, downloadedName);

      await decryptFile(encryptedData, uploadPath, ownerId);

      filesToZip.push({ path: uploadPath, name: modifiedFileName });
    } catch (error) {
      // Skip this file instead of aborting the whole batch.
      console.error(`Failed to download/decrypt ${dropboxPath}:`, error);
      failed.push(dropboxPath);
    }
  }

  // Only error out if nothing at all could be downloaded.
  if (filesToZip.length === 0) {
    return res.status(500).json({
      error: "Error downloading file",
      failed,
    });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=attachment.zip");
  res.zip(filesToZip);
  } catch (error) {
    console.error("downloadFilesFromCloud error:", error);
    return res.status(500).json({ error: "Unable to prepare cloud download. Please try again." });
  }
};

async function decryptFile(encryptedData, uploadPath, ownerId) {
  try {
    const buf = Buffer.isBuffer(encryptedData)
      ? encryptedData
      : Buffer.from(encryptedData);

    let decrypted;

    if (isHybridFormat(buf)) {
      // New hybrid path: recover the owner's ECC private key (decrypting it
      // at rest with the server MASTER_KEY), then ECIES-unwrap + AES-GCM.
      const owner = await User.findById(ownerId).select("+eccPrivateKeyEnc");
      if (!owner || !owner.eccPrivateKeyEnc) {
        throw new Error("owner private key unavailable");
      }
      const privateKey = unprotectPrivateKey(owner.eccPrivateKeyEnc);
      decrypted = decryptFileHybrid(buf, privateKey);
    } else {
      // Legacy fallback: old AES-256-CBC files ([16-byte IV] ++ ciphertext).
      decrypted = decryptLegacyCbc(buf);
    }

    await fs.writeFile(uploadPath, decrypted);
    return decrypted;
  } catch (error) {
    console.error(error);
    throw new Error("decryption failed");
  }
}

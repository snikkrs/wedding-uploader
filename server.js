import express from "express";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";

const app = express();

// Multer setup: temp storage + optional file size limit
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB per file
});

// Load Google service account key from env
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error("Missing env GOOGLE_SERVICE_ACCOUNT_KEY");
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  process.exit(1);
}

// Hardcoded folder ID
const FOLDER_ID = "1Nx--yRj1XOd19W2WYY_pUlc0HkmPkNnr";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES
});
const drive = google.drive({ version: "v3", auth });

// Serve frontend
app.use(express.static("public"));

// Upload endpoint
app.post("/upload", upload.array("photo"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }

  console.log("Uploading to folder ID:", FOLDER_ID);
  console.log("Number of files to upload:", req.files.length);

  try {
    for (const file of req.files) {
      const fileName = `${Date.now()}_${file.originalname}`;
      const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };
      const fileMetadata = {
        name: fileName,
        parents: [FOLDER_ID], // FORCE upload into the shared folder
      };

      const resp = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id"
      });

      console.log(`Uploaded file ${fileName} → ID: ${resp.data.id}`);
      // Remove temp file
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    res.send("Upload successful!");
  } catch (err) {
    console.error("Google Drive upload error:", err.errors || err.message);
    // Clean up any remaining temp files
    for (const f of req.files) { try { fs.unlinkSync(f.path); } catch (_) {} }
    res.status(500).send("Google Drive upload failed: " + (err?.message || "Unknown error"));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

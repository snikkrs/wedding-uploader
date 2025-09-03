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

// --- Load Google service account key ---
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  console.error("Missing env GOOGLE_SERVICE_ACCOUNT_KEY");
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON:", e.message);
  process.exit(1);
}

// Hardcoded folder ID
const FOLDER_ID = "1Nx--yRj1XOd19W2WYY_pUlc0HkmPkNnr";

// --- Initialize Google Drive client ---
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES
});
const drive = google.drive({ version: "v3", auth });

console.log("Server starting...");
console.log("Service account email:", credentials.client_email);
console.log("Uploading files to folder ID:", FOLDER_ID);

// Serve frontend
app.use(express.static("public"));

// Upload endpoint
app.post("/upload", upload.array("photo"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }

  console.log("Number of files to upload:", req.files.length);

  try {
    for (const file of req.files) {
      const fileName = `${Date.now()}_${file.originalname}`;
      const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };
      const fileMetadata = {
        name: fileName,
        parents: [FOLDER_ID], // force upload into shared folder
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

    // Clean up temp files on error
    for (const f of req.files) { try { fs.unlinkSync(f.path); } catch (_) {} }

    res.status(500).send("Google Drive upload failed: " + (err?.message || "Unknown error"));
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

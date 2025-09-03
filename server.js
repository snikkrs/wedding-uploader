import express from "express";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";

const app = express();

// --- Multer: temp dir + optional size limit (e.g., 25 MB per file)
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 }, // adjust if needed
});

// --- Google Drive auth from env JSON (DO NOT commit the JSON file)
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

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES,
});
const drive = google.drive({ version: "v3", auth });

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
if (!FOLDER_ID) {
  console.error("Missing env GOOGLE_DRIVE_FOLDER_ID");
  process.exit(1);
}

app.use(express.static("public"));

app.post("/upload", upload.array("photo"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }

  try {
    // Upload sequentially to keep memory stable
    for (const file of req.files) {
      const fileName = `${Date.now()}_${file.originalname}`;
      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
      };
      const fileMetadata = { name: fileName, parents: [FOLDER_ID] };

      const resp = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id",
      });

      // Remove temp file
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      if (!resp || !resp.data || !resp.data.id) {
        return res.status(500).send("Google Drive upload failed.");
      }
    }

    res.send("Upload successful!");
  } catch (err) {
    console.error("Google Drive error:", err?.response?.data || err.message);
    // Clean up any remaining temp files on error
    for (const f of req.files) {
      try {
        fs.unlinkSync(f.path);
      } catch (_) {}
    }
    res
      .status(500)
      .send("Google Drive upload failed: " + (err?.message || "Unknown error"));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

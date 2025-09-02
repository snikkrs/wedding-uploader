import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

// Read access token from environment variable
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

app.use(express.static("public")); // serve frontend

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const fileContents = fs.readFileSync(filePath);

    const response = await fetch(
      "https://content.dropboxapi.com/2/files/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: `/${fileName}`,
            mode: "add",
            autorename: true,
          }),
          "Content-Type": "application/octet-stream",
        },
        body: fileContents,
      }
    );

    fs.unlinkSync(filePath); // cleanup temp file

    if (response.ok) {
      res.send("✅ File uploaded successfully!");
    } else {
      const err = await response.text();
      res.status(500).send("❌ Upload failed: " + err);
    }
  } catch (err) {
    res.status(500).send("❌ Error: " + err.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

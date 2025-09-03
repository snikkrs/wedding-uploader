import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

app.use(express.static("public"));

// Handle multiple files
app.post("/upload", upload.array("photo"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }

  try {
    // Upload each file sequentially
    for (const file of req.files) {
      const fileContent = fs.readFileSync(file.path);

      const dropboxRes = await fetch(
        "https://content.dropboxapi.com/2/files/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: `/${Date.now()}_${file.originalname}`,
              mode: "add",
              autorename: true,
              mute: false,
            }),
            "Content-Type": "application/octet-stream",
          },
          body: fileContent,
        }
      );

      if (!dropboxRes.ok) {
        const err = await dropboxRes.text();
        console.error("Dropbox error:", err);
        return res.status(500).send("Dropbox upload failed: " + err);
      }

      // cleanup temp file
      fs.unlinkSync(file.path);
    }

    res.send("Upload successful!");
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

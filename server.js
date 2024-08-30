const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.post("/videoinfo", async (req, res) => {
  const videoUrl = req.body.url;

  if (!ytdl.validateURL(videoUrl)) {
    console.error("Invalid YouTube URL:", videoUrl);
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    console.log("Fetching video info for URL:", videoUrl);
    const info = await ytdl.getInfo(videoUrl);
    console.log("Available formats:", info.formats); // Log available formats

    const formats = ytdl.filterFormats(info.formats, "audioandvideo");

    const videoDetails = {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.pop().url, // highest quality thumbnail
      author: info.videoDetails.author.name,
      availableQualities: formats.map((format) => ({
        quality: format.qualityLabel,
        audioQuality: format.audioQuality,
        url: format.url,
      })),
      audioList: ytdl
        .filterFormats(info.formats, "audioonly")
        .map((format) => ({
          quality: format.audioQuality,
          url: format.url,
        })),
    };

    console.log("Video details retrieved successfully:", videoDetails);
    res.json(videoDetails);
  } catch (error) {
    console.error("Failed to retrieve video details:", error.message);
    res.status(500).json({ error: "Failed to retrieve video details" });
  }
});

app.post("/api/download", async (req, res) => {
  const videoUrl = req.body.url;

  if (!videoUrl) {
    console.error("No YouTube URL provided.");
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  try {
    console.log("Fetching video info for download URL:", videoUrl);
    const info = await ytdl.getInfo(videoUrl);
    // console.log("Available formats:", info.formats); // Log available formats

    // Automatically select the best format
    let format = ytdl.chooseFormat(info.formats, { quality: "highest" });

    if (!format) {
      console.log(
        `Requested quality not found. Falling back to a random format.`
      );
      format = info.formats[0]; // Fallback to the first available format
    }

    if (!format) {
      console.error("No valid format found.");
      return res.status(500).json({ error: "No valid format found" });
    }

    console.log(
      `Selected format: ${format.qualityLabel || "unknown"} (${
        format.itag
      }) with size ${format.filesize || "unknown size"}`
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${info.videoDetails.title}.mp4"`
    );
    res.setHeader("Content-Type", "video/mp4");

    const videoStream = ytdl(videoUrl, {
      format: format.itag,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.youtube.com/",
        },
      },
    });

    videoStream.pipe(res);

    videoStream.on("error", (error) => {
      console.error("Streaming error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading video" });
      }
    });

    videoStream.on("end", () => {
      console.log("Streaming complete.");
    });
  } catch (error) {
    console.error("Server error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download video" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

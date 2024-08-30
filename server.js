const express = require("express");
const youtubedl = require("youtube-dl-exec");
const stream = require("stream");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.post("/videoinfo", async (req, res) => {
  const videoUrl = req.body.url;

  if (!ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(videoUrl);
    const formats = ytdl.filterFormats(info.formats, "audioandvideo");

    const videoDetails = {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.pop(), // highest quality thumbnail
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

    res.json(videoDetails);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve video details" });
  }
});

app.post("/api/download", async (req, res) => {
  const videoUrl = req.body.url;
  const qualityLabel = req.body.quality || "lowest";

  console.log("Received download request:", { videoUrl, qualityLabel });

  if (!videoUrl) {
    console.error("No YouTube URL provided");
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  try {
    // Get video info
    const videoInfo = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      addHeader: ["referer:youtube.com", "user-agent:googlebot"],
    });

    console.log("Video Info:", videoInfo.title);

    // Filter formats based on quality
    let format = videoInfo.formats.find((f) => f.format_note === qualityLabel);

    if (!format) {
      console.log(
        `Requested quality (${qualityLabel}) not found. Falling back to the best quality.`
      );
      format = videoInfo.formats.reduce((prev, curr) => {
        return prev.filesize < curr.filesize ? prev : curr;
      });
    }

    console.log(
      "Selected format:",
      format.format_note,
      "(",
      format.filesize || "unknown size",
      "bytes)"
    );

    // Set headers before starting the stream
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoInfo.title}.mp4"`
    );
    res.setHeader("Content-Type", "video/mp4");

    // Streaming the video with buffering
    const videoStream = youtubedl.exec(videoUrl, {
      format: format.format_id,
      output: "-",
      bufferSize: "64K", // Example buffer size
    });

    // Pipe the video stream to the response
    videoStream.stdout.pipe(res);

    videoStream.stderr.on("data", (err) => {
      console.error("Streaming error:", err.toString());
      if (!res.headersSent) {
        res.status(500).send("Error downloading video");
      }
    });

    videoStream.stdout.on("data", (chunk) => {
      console.log("Streaming chunk of size:", chunk.length);
    });

    videoStream.stdout.on("end", () => {
      console.log("Streaming complete.");
    });
  } catch (error) {
    if (!res.headersSent) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Failed to download video" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

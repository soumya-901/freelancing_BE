const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/api/videoinfo", async (req, res) => {
  const videoUrl = req.query.url;

  if (!ytdl.validateURL(videoUrl)) {
    console.error("Invalid YouTube URL:", videoUrl);
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    console.log("Fetching video info for URL:", videoUrl);
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://www.youtube.com/",
          Accept: "*/*",
        },
      },
    });

    const videoFormats = ytdl.filterFormats(info.formats, "videoonly");
    const audioVideoFormats = ytdl.filterFormats(info.formats, "audioandvideo");
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");

    // Combine and sort formats
    const combinedFormats = [...audioVideoFormats, ...videoFormats].sort(
      (a, b) => {
        const getQuality = (format) => parseInt(format.qualityLabel) || 0;
        if (a.hasAudio && !b.hasAudio) return -1; // Prioritize formats with audio
        if (!a.hasAudio && b.hasAudio) return 1;
        return getQuality(b) - getQuality(a); // Sort by quality in descending order
      }
    );

    // Function to check if a URL is working
    const isUrlWorking = async (url) => {
      try {
        const response = await axios.get(url, {
          headers: { Range: "bytes=0-1024" }, // Request only the first 1KB
          timeout: 3000, // Set a timeout for the request
        });
        console.log("getting responce", response.status);
        return response.status === 206 || response.status == 200;
      } catch (error) {
        if (error.response && error.response.status === 403) {
          console.error("URL returned 403 Forbidden:", url);
        }
        return false;
      }
    };

    // Filter working URLs
    const filterWorkingUrls = async (formats) => {
      const results = [];
      for (const format of formats) {
        if (await isUrlWorking(format.url)) {
          results.push(format);
        }
      }
      return results;
    };

    // Get working video formats
    const videoFormatsWorking = await filterWorkingUrls(combinedFormats);
    const audioFormatsWorking = await filterWorkingUrls(audioFormats);
    const wavFormatsWorking = await filterWorkingUrls(
      audioVideoFormats.filter((f) => f.container === "wav")
    );

    const videoDetails = {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.pop().url, // highest quality thumbnail
      author: info.videoDetails.author.name,
      videoFormats: videoFormatsWorking.map((format) => ({
        quality: format.qualityLabel,
        hasAudio: format.hasAudio,
        url: format.url,
        mimeType: format.mimeType,
        codec: format.codecs,
      })),
      audioFormats: audioFormatsWorking.map((format) => ({
        audioQuality: format.audioQuality,
        url: format.url,
        mimeType: format.mimeType,
        codec: format.codecs,
      })),
      wavFormats: wavFormatsWorking.map((format) => ({
        quality: format.qualityLabel,
        hasAudio: format.hasAudio,
        url: format.url,
        mimeType: format.mimeType,
        codec: format.codecs,
      })),
    };

    // console.log("Video details retrieved successfully:", videoDetails);
    res.json(videoDetails);
  } catch (error) {
    console.error("Failed to retrieve video details:", error.message);
    res.status(500).json({ error: "Failed to retrieve video details" });
  }
});

app.get("/download-audio", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // Get video info
    const videoInfo = await ytdl.getInfo(videoUrl);

    // Find the highest quality audio stream
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!audioFormat) {
      return res.status(404).json({ error: "No suitable audio format found" });
    }

    // Set headers for download
    res.header(
      "Content-Disposition",
      `attachment; filename="${videoInfo.videoDetails.title}.mp3"`
    );
    res.header("Content-Type", "audio/mpeg");

    // Stream the audio and convert to MP3
    const audioStream = ytdl(videoUrl, {
      format: audioFormat,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
      },
    });

    ffmpeg(audioStream)
      .audioCodec("libmp3lame")
      .format("mp3")
      .on("end", () => {
        console.log("Audio download complete");
      })
      .on("error", (err) => {
        console.error("Error during audio processing:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error during audio processing" });
        }
      })
      .pipe(res, { end: true });
  } catch (error) {
    console.error("Error processing video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process video" });
    }
  }
});

app.get("/download-video", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // Get video info
    const videoInfo = await ytdl.getInfo(videoUrl);

    // Find the highest quality video stream
    const videoFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: "highestvideo",
      filter: (format) =>
        format.container === "mp4" && format.hasVideo && !format.hasAudio,
    });

    // Find the highest quality audio stream
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!videoFormat || !audioFormat) {
      return res
        .status(404)
        .json({ error: "Suitable video/audio format not found" });
    }

    // Create temporary file paths
    const videoPath = path.resolve(__dirname, "video.mp4");
    const audioPath = path.resolve(__dirname, "audio.mp3");
    const outputPath = path.resolve(
      __dirname,
      `${videoInfo.videoDetails.title}.mp4`
    );

    // Stream the video and audio to local files
    const videoStream = ytdl(videoUrl, {
      format: videoFormat,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
      },
    });

    const audioStream = ytdl(videoUrl, {
      format: audioFormat,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
      },
    });

    // Save video and audio streams to temporary files
    await new Promise((resolve, reject) => {
      videoStream
        .pipe(fs.createWriteStream(videoPath))
        .on("finish", resolve())
        .on("error", reject());
    });
    console.log("video stream write complete", videoPath);
    await new Promise((resolve, reject) => {
      audioStream
        .pipe(fs.createWriteStream(audioPath))
        .on("finish", resolve())
        .on("error", reject());
    });
    console.log("audio stream write complete", audioPath);
    // Check if the files were successfully created
    if (!fs.existsSync(videoPath)) {
      throw new Error("Video file not found");
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error("Audio file not found");
    }

    setTimeout(() => {
      // Merge video and audio using ffmpeg and send the result
      ffmpeg()
        .input("video.mp4")
        .input("audio.mp3")
        .videoCodec("copy")
        .audioCodec("copy")
        .outputOptions("-strict -2")
        .output(outputPath)
        .on("end", () => {
          console.log("Merging complete");
          res.download(
            outputPath,
            `${videoInfo.videoDetails.title}.mp4`,
            (err) => {
              // Clean up temporary files after download
              fs.unlink(videoPath, () => {});
              fs.unlink(audioPath, () => {});
              fs.unlink(outputPath, () => {});
            }
          );
        })
        .on("error", (err, stdout, stderr) => {
          console.error("Error during merging:", err);
          console.error("FFmpeg stderr output:", stderr);
          res.status(500).json({ error: "Error during merging" });
          // fs.unlink(videoPath, () => {});
          // fs.unlink(audioPath, () => {});
          // fs.unlink(outputPath, () => {});
        })
        .run();
    }, 20000);
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({ error: "Failed to process video" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

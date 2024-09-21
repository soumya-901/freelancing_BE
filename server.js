const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const agent = ytdl.createAgent(JSON.parse(fs.readFileSync("cookie.json")));

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
    // const agent = ytdl.createAgent(JSON.parse(fs.readFileSync("cookies.json")));
    const info = await ytdl.getInfo(videoUrl, { agent });
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

    // Helper function to select one format per video quality
    const selectHighestQualityFormat = (formats) => {
      const qualityMap = new Map();
      for (const format of formats) {
        const quality = format.qualityLabel || format.audioQuality;
        if (!qualityMap.has(quality)) {
          qualityMap.set(quality, format); // Add the format if no other format of this quality exists
        }
      }
      return Array.from(qualityMap.values());
    };

    // Function to check if a URL is working
    const isUrlWorking = async (url) => {
      try {
        const response = await axios.get(url, {
          headers: { Range: "bytes=0-1024" }, // Request only the first 1KB
          timeout: 3000, // Set a timeout for the request
        });
        console.log("Getting response", response.status);
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

    // Select highest quality formats for both video and audio
    const uniqueVideoFormats = selectHighestQualityFormat(videoFormatsWorking);
    const uniqueAudioFormats = selectHighestQualityFormat(audioFormatsWorking);
    const uniqueWavFormats = selectHighestQualityFormat(wavFormatsWorking);

    const videoDetails = {
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.pop().url, // highest quality thumbnail
      author: info.videoDetails.author.name,
      videoFormats: uniqueVideoFormats.map((format) => ({
        quality: format.qualityLabel,
        hasAudio: format.hasAudio,
        url: format.url,
        mimeType: format.mimeType,
        codec: format.codecs,
      })),
      audioFormats: uniqueAudioFormats.map((format) => ({
        audioQuality: format.audioQuality,
        url: format.url,
        mimeType: format.mimeType,
        codec: format.codecs,
      })),
      wavFormats: uniqueWavFormats.map((format) => ({
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

const audioQualityMapping = {
  low: "139", // Lowest quality (48kbps)
  medium: "140", // Medium quality (128kbps)
  high: "251", // Highest quality (160kbps Opus)
};

app.get("/api/download/audio", async (req, res) => {
  const videoUrl = req.query.url;
  const quality = req.query.quality; // low, medium, or high

  if (!ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  console.log("Downloading audio for URL:", videoUrl, "with quality:", quality);

  try {
    const info = await ytdl.getInfo(videoUrl, { agent });
    const selectedTag =
      audioQualityMapping[quality] || audioQualityMapping["low"]; // Default to medium if quality is not provided

    console.log("selected tag ", selectedTag);
    // Select the audio format based on the quality
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "lowestaudio",
      filter: "audioonly",
    });
    console.log("selected audio format ", audioFormat);
    if (!audioFormat) {
      return res
        .status(404)
        .json({ error: "Requested audio format not found" });
    }

    const title = info.videoDetails.title; // Sanitize the video title
    const fileName = `${title}.mp3`; // You can also use other extensions like .ogg based on the codec

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Content-Type", "audio/mpeg");

    console.log("Starting audio download");

    const audioStream = ytdl(videoUrl, { format: audioFormat, agent });

    // Handle stream errors
    audioStream.on("error", (streamError) => {
      console.error("Stream error:", streamError.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error while streaming the audio" });
      }
    });

    // Notify the frontend when the download starts
    audioStream.on("pipe", () => {
      console.log("Audio stream started.");
    });

    // Listen to the 'end' event to notify the client when the download completes
    audioStream.on("end", () => {
      console.log("Audio download completed.");
      if (!res.headersSent) {
        res.end(
          JSON.stringify({ message: "Audio download completed successfully" })
        );
      }
    });

    // Pipe the audio stream to the response
    audioStream.pipe(res);
  } catch (error) {
    console.error("Failed to download audio:", error.message);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Failed to download audio: " + error.message });
    }
  }
});

const tagQualityMapping = {
  "360p": "18",
  "1080p": "248",
  "720p": "136",
  "480p": "135",
};

app.get("/api/download/video", async (req, res) => {
  const videoUrl = req.query.url;
  let format = req.query.format.toString(); // Expect format information in query

  if (!ytdl.validateURL(videoUrl)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(videoUrl, { agent });
    console.log("requested format ", format);
    const tag = "18";
    if (!tag) {
      return res.status(400).json({ error: "Invalid format tag" });
    }

    const videoFormat = ytdl.chooseFormat(info.formats, { quality: tag });
    if (!videoFormat) {
      return res
        .status(404)
        .json({ error: "Requested video format not found" });
    }

    const title = info.videoDetails.title; // Sanitize the video title
    const fileName = `${title}.mp4`;

    // Headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader("Content-Type", "video/mp4");

    console.log("Starting video download...");

    const videoStream = ytdl(videoUrl, { format: videoFormat, agent });

    // Stream errors handling
    videoStream.on("error", (streamError) => {
      console.error("Stream error:", streamError.message);
      console.log(streamError);
      // If headers haven't been sent yet, send the error
      if (!res.headersSent) {
        res.status(500).json({ error: "Error while streaming the video" });
      }
    });

    // Listen for download start
    res.on("pipe", () => {
      console.log("Video stream started.");
    });

    // Listen for stream end
    videoStream.on("end", () => {
      console.log("Download completed.");
      if (!res.headersSent) {
        res.end();
      }
    });

    // Pipe the video stream to the response
    videoStream.pipe(res);
  } catch (error) {
    console.error("Failed to download video:", error.message);
    console.log(error);
    // If the response hasn't been sent yet, send the error
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Failed to download video: " + error.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

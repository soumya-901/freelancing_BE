const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.post("/api/videoinfo", async (req, res) => {
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

app.get("/bala", (req, res) => {
  try {
    const videoPath = "video.mp4"; // Replace with your video file path
    const audioPath = "audio.mp3"; // Replace with your audio file path
    const outputPath = "merged_output.mp4"; // Replace with desired output path

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .videoCodec("copy")
      .audioCodec("copy")
      .output(outputPath)
      .on("end", () => {
        console.log("Complete");
      })
      .on("error", (err) => {
        console.error("Error during merging:", err);
      })
      .run();
    res.send("running");
  } catch (error) {
    console.log(error);
    res.send("erro");
  }
});

app.get("/download", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    console.error("No YouTube URL provided.");
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  const tempVideoPath = path.join(__dirname, "temp_video.mp4");
  const tempAudioPath = path.join(__dirname, "temp_audio.mp4");
  const finalOutputPath = path.join(__dirname, "final_output.mp4");

  try {
    console.log("Fetching video info for URL:", videoUrl);

    const info = await ytdl.getInfo(videoUrl);
    const videoFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestvideo",
    });
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
    });

    if (!videoFormat || !audioFormat) {
      console.error("No suitable formats found.");
      return res.status(500).json({ error: "No suitable formats found" });
    }

    console.log("Selected video format:", videoFormat.itag);
    console.log("Selected audio format:", audioFormat.itag);

    const videoStream = ytdl(videoUrl, { format: videoFormat.itag });
    const audioStream = ytdl(videoUrl, { format: audioFormat.itag });

    const videoFileStream = fs.createWriteStream(tempVideoPath);
    const audioFileStream = fs.createWriteStream(tempAudioPath);

    videoStream.pipe(videoFileStream);
    audioStream.pipe(audioFileStream);

    // videoFileStream.on("finish", () => {
    //   audioFileStream.on("finish", () => {
    //     console.log("start merging the audio and video");
    //     ffmpeg(tempVideoPath)
    //       .input(tempAudioPath)
    //       .audioCodec("aac")
    //       .videoCodec("copy")
    //       .format("mp4")
    //       .setFfmpegPath(ffmpegPath) // Ensure this path is set correctly
    //       .on("end", () => {
    //         console.log("Finished processing and merging streams.");
    //         res.download(finalOutputPath, (err) => {
    //           if (err) {
    //             console.error("Error sending file:", err.message);
    //             res.status(500).json({ error: "Error sending file" });
    //           }
    //           fs.unlink(tempVideoPath, () => {});
    //           fs.unlink(tempAudioPath, () => {});
    //           fs.unlink(finalOutputPath, () => {});
    //         });
    //       })
    //       .on("error", (err) => {
    //         console.error("Error during ffmpeg processing:", err.message);
    //         res.status(500).json({ error: "Error processing video" });
    //       })
    //       .save(finalOutputPath);
    //   });
    // });

    console.log("write file complete");
    // await new Promise((resolve, reject) => {
    //   let videoStreamEnded = false;
    //   let audioStreamEnded = false;
    //   console.log("inside promise");
    //   const checkIfBothEnded = () => {
    //     if (videoStreamEnded && audioStreamEnded) {
    //       console.log("Both video and audio streams ended.");
    //       resolve();
    //     }
    //   };

    //   videoStream.on("end", () => {
    //     console.log("Video stream ended");
    //     videoStreamEnded = true;
    //     checkIfBothEnded();
    //   });

    //   audioStream.on("end", () => {
    //     console.log("Audio stream ended");
    //     audioStreamEnded = true;
    //     checkIfBothEnded();
    //   });

    //   videoStream.on("error", (err) => {
    //     console.error("Video stream error:", err);
    //     reject(err);
    //   });

    //   audioStream.on("error", (err) => {
    //     console.error("Audio stream error:", err);
    //     reject(err);
    //   });

    //   // Optionally handle the 'close' event if necessary
    //   videoStream.on("close", () => {
    //     console.log("Video stream closed");
    //   });

    //   audioStream.on("close", () => {
    //     console.log("Audio stream closed");
    //   });
    // });
  } catch (error) {
    console.error("Server error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download and merge video" });
    }
  }
});

// app.get("/download", async (req, res) => {
//   try {
//     const url = req.query.url;
//     console.log("collection video url");
//     const videoId = ytdl.getURLVideoID(url);
//     console.log("getting video info");
//     const metaInfo = await ytdl.getInfo(url);
//     let data = {
//       url: "https://www.youtube.com/embed/" + videoId,
//       info: metaInfo.formats,
//     };
//     return res.send(data);
//   } catch (error) {
//     return res.status(500).send(error);
//   }
// });

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

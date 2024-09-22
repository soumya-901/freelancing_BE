const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const {
  scrapeFromOtherWeb,
  clickButtonByQuality,
} = require("./scrappingFromotherweb");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const filterQuality = (quality) => {
  const match = quality.match(/(\d+)/); // Extract numeric value from quality string
  return match && parseInt(match[1]) <= 1080;
};

app.get("/api/videoinfo", async (req, res) => {
  const videoUrl = req.query.url;

  try {
    if (!ytdl.validateURL(videoUrl)) {
      return res
        .status(400)
        .json({ error: "Please Provide a Valid youtube url" });
    }
    const { buttons, browser, page, videotileduraiton, videoimg } =
      await scrapeFromOtherWeb(videoUrl);
    const ClarityList = [];
    for (const button of buttons) {
      const onclickValue = await button.evaluate((btn) =>
        btn.getAttribute("onclick")
      );
      console.log(
        "Button onclick attribute:",
        onclickValue,
        " and its type ",
        typeof onclickValue
      );
      if (onclickValue) {
        const matches = onclickValue
          .toString()
          .match(/download\('.*?','.*?','.*?','(.*?)',(\d+),'(.*?)','(.*?)'\)/);
        if (matches) {
          ClarityList.push({
            format: matches[1],
            size: parseInt(matches[2], 10),
            quality: matches[3],
            tag: matches[4] || null,
          });
        } else {
          ClarityList.push(null);
        }
      }
    }
    const allClarityDetails = ClarityList.filter(
      (item) => item && filterQuality(item.quality)
    );
    const videoDetails = {
      title: videotileduraiton?.title,
      picture: videoimg,
      duration: videotileduraiton?.duration,
      availableClarity: allClarityDetails,
    };
    // console.log("Video details retrieved successfully:", videoDetails);
    res.json(videoDetails);
    browser.close();
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
  const audiourl = req.query.url;
  let format = req.query.format?.toString(); // Expect format information in query

  try {
    const { buttons, browser, page, videotileduraiton, videoimg } =
      await scrapeFromOtherWeb(audiourl);
    const downloadUrl = await clickButtonByQuality(buttons, format + "k", page);
    res.json({ DownloadURL: downloadUrl });
    browser.close();
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

const tagQualityMapping = {
  "360p": "18",
  "1080p": "137",
  "720p": "136",
  "480p": "135",
};

app.get("/api/download/video", async (req, res) => {
  const videoUrl = req.query.url;
  let format = req.query.format?.toString(); // Expect format information in query

  try {
    const { buttons, browser, page, videotileduraiton, videoimg } =
      await scrapeFromOtherWeb(videoUrl);
    const downloadUrl = await clickButtonByQuality(buttons, format + "p", page);
    res.json({ DownloadURL: downloadUrl });
    browser.close();
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

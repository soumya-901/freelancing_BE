const ytdl = require("ytdl-core");
const fs = require("fs");
const videoId = "https://www.youtube.com/watch?v=ZVnjOPwW4ZA&t=3306s";
const getVideoInfo = async (req, res) => {
  try {
    // const videoInfo = await ytdl.getBasicInfo(
    //   "https://www.youtube.com/watch?v=ZVnjOPwW4ZA&t=3306s"
    // );
    // console.log("video info ", videoInfo);

    ytdl(videoId).pipe(fs.createWriteStream("video.mp4"));
    // res.send(videoInfo);
  } catch (error) {
    console.log("errro in youtube downloader ", error);
  }
};

module.exports = { getVideoInfo };

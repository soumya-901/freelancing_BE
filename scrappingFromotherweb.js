const puppeteer = require("puppeteer");
const { setTimeout } = require("timers/promises");

async function scrapeFromOtherWeb(youtubeUrl) {
  // Launch a browser in headless mode
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome-stable",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  // Navigate to the website
  await page.goto("https://yt1d.com/en/");

  // Input the YouTube URL
  await page.waitForSelector("input[id=txt-url]", { visible: true });
  await page.type("input[id=txt-url]", youtubeUrl);

  await page.keyboard.press("Enter");

  // Wait until all buttons with the class "btn btn-sm btn-success" are loaded
  await page.waitForSelector(".btn.btn-sm.btn-success");

  // Find and return all buttons
  const buttons = await findButtons(page);

  const videotileduraiton = await extractTitleAndDuration(page);

  const videoimg = await extractImageUrl(page);

  return { buttons, browser, page, videotileduraiton, videoimg };
}

async function extractImageUrl(page) {
  // Wait for the img element to load
  await page.waitForSelector("img.img-thumbnail");

  // Use evaluate to extract the src attribute from the img element
  const imageUrl = await page.evaluate(() => {
    const imgElement = document.querySelector("img.img-thumbnail");
    return imgElement ? imgElement.getAttribute("src") : null;
  });

  if (imageUrl) {
    console.log("Image URL:", imageUrl);
  } else {
    console.log("No image URL found.");
  }

  return imageUrl;
}

async function extractTitleAndDuration(page) {
  // Wait for the div containing the title and duration
  await page.waitForSelector("div.caption.text-left");

  // Use evaluate to extract the title and duration
  const result = await page.evaluate(() => {
    // Find the span with id 'video_title' for the title
    const title = document.querySelector("span#video_title")?.innerText;

    // Find the p tag inside the div.caption.text-left that contains 'Duration'
    const duration = Array.from(
      document.querySelectorAll("div.caption.text-left p")
    ).find((p) => p.innerText.includes("Duration"))?.innerText;

    return { title, duration };
  });

  if (result) {
    console.log("Video Title:", result.title);
    console.log("Video Duration:", result.duration);
  } else {
    console.log("No title or duration found.");
  }

  return result;
}

async function findButtons(page) {
  // Get all buttons with the specific class
  const buttons = await page.$$(".btn.btn-sm.btn-success");
  console.log("Found buttons:", buttons);
  return buttons;
}

async function clickButtonByQuality(buttons, quality, page) {
  // Loop through buttons and find the one with the desired quality in the onclick function

  console.log("inside the click button by quality funciton ", quality);
  for (const button of buttons) {
    const onclickValue = await button.evaluate((btn) =>
      btn.getAttribute("onclick")
    );
    console.log("Button onclick attribute:", onclickValue);

    // Check if the onclick contains the desired quality (e.g., '720p')
    if (onclickValue && onclickValue.includes(`'${quality}'`)) {
      console.log(
        `Found button with ${quality}p quality. Clicking the button...`
      );
      await button.click();
      break; // Exit the loop after clicking the correct button
    }
  }

  // Proceed to the next steps
  //   await handleDownloadLink(page);
  // Wait for the modal body and download link
  console.log("waiting for modal ");
  await setTimeout(5000); // Wait for the modal to appear
  await page.waitForSelector(".modal-body");
  await setTimeout(3000);
  await page.waitForSelector("#A_downloadUrl");

  const downloadUrlElement = await page.$("#A_downloadUrl");
  console.log("gettting the url ", downloadUrlElement);
  if (downloadUrlElement) {
    const downloadUrl = await downloadUrlElement.evaluate((el) =>
      el.getAttribute("href")
    );
    console.log("Download URL:", downloadUrl);
    // Optionally, return the download URL
    return downloadUrl;
  } else {
    console.log("No download link found.");
    return null;
  }
}

// Example usage
// (async () => {
//   const youtubeUrl = "https://youtu.be/bi2OPrRwSTk?si=V2jmbeIRHS880zqZ"; // Replace with your YouTube URL
//   const quality = "720"; // Specify the desired quality

//   const downloadUrl = await clickButtonByQuality(buttons, quality, page);
//   console.log("download url ", downloadUrl);
//   browser.close();
// })();

module.exports = {
  scrapeFromOtherWeb,
  clickButtonByQuality,
};

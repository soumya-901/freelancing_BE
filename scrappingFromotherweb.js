const puppeteer = require("puppeteer");
const { setTimeout } = require("timers/promises");

async function scrapeFromOtherWeb(youtubeUrl) {
  // Launch a browser in headless mode
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/usr/bin/google-chrome",
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

  return { buttons, browser, page };
}

async function findButtons(page) {
  // Get all buttons with the specific class
  const buttons = await page.$$(".btn.btn-sm.btn-success");
  console.log("Found buttons:", buttons);
  return buttons;
}

async function clickButtonByQuality(buttons, quality, page) {
  // Loop through buttons and find the one with the desired quality in the onclick function
  for (const button of buttons) {
    const onclickValue = await button.evaluate((btn) =>
      btn.getAttribute("onclick")
    );
    console.log("Button onclick attribute:", onclickValue);

    // Check if the onclick contains the desired quality (e.g., '720p')
    if (onclickValue && onclickValue.includes(`'${quality}p'`)) {
      console.log(
        `Found button with ${quality}p quality. Clicking the button...`
      );
      await button.click();
      await setTimeout(5000); // Wait for the modal to appear
      break; // Exit the loop after clicking the correct button
    }
  }

  // Proceed to the next steps
  //   await handleDownloadLink(page);
  // Wait for the modal body and download link
  await page.waitForSelector(".modal-body");
  await page.waitForSelector("#A_downloadUrl");

  const downloadUrlElement = await page.$("#A_downloadUrl");
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
(async () => {
  const youtubeUrl = "https://youtu.be/bi2OPrRwSTk?si=V2jmbeIRHS880zqZ"; // Replace with your YouTube URL
  const quality = "720"; // Specify the desired quality

  const { buttons, browser, page } = await scrapeFromOtherWeb(youtubeUrl);
  const downloadUrl = await clickButtonByQuality(buttons, quality, page);
  console.log("download url ", downloadUrl);
  browser.close();
})();

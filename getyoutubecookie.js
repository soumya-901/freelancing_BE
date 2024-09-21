const puppeteer = require("puppeteer");
const fs = require("fs");
const { setTimeout } = require("timers/promises");
const { text } = require("express");

async function loginToGoogleAndSaveCookies(email, password) {
  // Launch a browser in headless mode
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/chromium-browser",
    });
    const page = await browser.newPage();

    // Navigate to Google Sign-In page
    console.log("navigate to google sign in ");
    await page.goto("https://accounts.google.com/signin");

    console.log("going to sign in ...");
    // await page.waitForNavigation({ waitUntil: "domcontentloaded" });

    await page.waitForSelector('input[type="email"]', { visible: true });
    // await page.waitForSelector('button[contains("Next")]', { visible: true });

    // Type in the email and click next
    await page.type('input[type="email"]', email);

    console.log("email entered.");
    // await page.click("#identifierNext");
    // await page.waitForXPath("//button[contains(., 'Next')]");
    // const [nextButton] = await page.$("//button[contains(., 'Next')]");
    // const [nextButton] = await page.$x("//button[.//span[text()='Next']]");
    // // // page.$eval;
    // if (nextButton) {
    //   await nextButton.click();
    // }
    await page.keyboard.press("Enter");
    // const nextButton = await page.evaluate(() => {
    //   console.log("document", document);
    //   const buttonNext = Array.from(document.querySelectorAll("button"));
    //   const data = buttonNext.map((btn) => {
    //     text: btn.querySelector("div");
    //   });
    //   return data;
    // });
    // console.log("next tbutton ", nextButton);
    // const enabled = await page
    //   .locator("button")
    //   .map((button) => button)
    //   .wait();

    // console.log("button got clicked", enabled);
    //   await page.waitForTimeout(2000); // Adjust the delay if needed
    await setTimeout(5000);

    // Type in the password and click next
    console.log("press next button");
    // await page.waitForSelector('input[type="password"]', { visible: true });
    await page.type('input[type="password"]', password);
    console.log("password entered ");
    await page.keyboard.press("Enter");
    //   await page.waitForTimeout(5000); // Adjust the delay for 2FA or other security prompts

    // Once logged in, navigate to YouTube
    await page.goto("https://www.youtube.com");
    await Promise.all([page.waitForNavigation({ waitUntil: "load" })]); // Wait for YouTube to load completely

    // Get cookies after successful login
    const cookies = await page.cookies();

    // Save cookies to a JSON file
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));

    console.log("Cookies saved to cookies.json");

    // Close the browser
    await browser.close();
  } catch (error) {
    console.log("erro is ", error);
  }
}

// Call the function with your Google email and password
loginToGoogleAndSaveCookies("soya.brik.123@gmail.com", "9938176272SS@");

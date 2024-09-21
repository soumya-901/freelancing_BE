const puppeteer = require("puppeteer");
const fs = require("fs");
const { setTimeout } = require("timers/promises");
const { text } = require("express");

let url = "https://youtu.be/tK4qSZHc9dk?si=ar51LL-jDRSjz5z2";

const data = async (url) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/chromium-browser",
    });
    const page = await browser.newPage();

    console.log("navigate to google sign in ");
    await page.goto("https://yt1d.com/en/");

    //   await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("navigate successfully");
    await page.type('input[type="text"]', url);

    await page.locator("#btn-submit").click();

    console.log("search for result");
    await browser.close();
  } catch (error) {
    console.log("error - ", error);
  }
};

data(url);

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('Starting Puppeteer test...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to builder...');
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle0' });

    console.log('Finding AI Assistant input...');
    await page.waitForSelector('input[placeholder="Create a hero section with..."]', { timeout: 5000 });

    console.log('Typing prompt...');
    await page.type('input[placeholder="Create a hero section with..."]', 'Make me a colorful, animated landing page for a modern high-end sneaker brand with dark mode and neon accents');

    console.log('Submitting...');
    await page.keyboard.press('Enter');

    console.log('Waiting for AI generation to complete (up to 30s)...');
    // Wait for the "Apply to Canvas" button to appear in the chat message
    await page.waitForSelector('button:has-text("Apply to Canvas")', { timeout: 35000 });

    console.log('Clicking Apply to Canvas...');
    await page.click('button:has-text("Apply to Canvas")');

    console.log('Waiting for blocks to render on canvas...');
    await page.waitForTimeout(3000);

    // Scroll down slightly so we can see the product cards if they rendered
    await page.evaluate(() => {
      const scrollArea = document.querySelector('.overflow-y-auto');
      if (scrollArea) scrollArea.scrollTop = 500;
    });

    await page.waitForTimeout(1000);

    console.log('Taking screenshot...');
    const screenshotPath = path.join(process.cwd(), 'sneaker_test_result.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log("Screenshot saved to " + screenshotPath);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

runTest();

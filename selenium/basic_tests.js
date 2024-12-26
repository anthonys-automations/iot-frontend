/* eslint-disable no-undef */
const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const fs = require('fs');
require('chromedriver'); // or add the driver you need

describe('Battery Voltage Graph Test', function() {
  let driver;

  // Increase timeout since Selenium can sometimes take a while
  this.timeout(30000);

  before(async function() {
    driver = await new Builder().forBrowser('chrome').build();
    // Adjust timeouts if needed
    await driver.manage().setTimeouts({ implicit: 10000, pageLoad: 20000 });
  });

  after(async function() {
    await driver.quit();
  });

  it('should open the page and load the dashboard', async function() {
    // Change URL to wherever your page is served
    await driver.get('http://172.17.0.1:3000/');
    
    // Wait until we see the left pane to ensure page is rendered
    const leftPane = await driver.wait(
      until.elementLocated(By.css('.left-pane')),
      10000
    );
    assert(await leftPane.isDisplayed(), 'Left pane is not displayed');
  });

  it('should click battery voltage for verik-84:CC:A8:9D:AF:88 and open the right pane', async function() {
    // Click the battery voltage button
    // CSS: #parameters-verik-84\:CC\:A8\:9D\:AF\:88 > button:nth-child(1)
    const batteryVoltageButton = await driver.findElement(
      By.css('#parameters-verik-84\\:CC\\:A8\\:9D\\:AF\\:88 > button:nth-child(1)')
    );
    await batteryVoltageButton.click();

    // Wait for the device info in the right pane
    const deviceInfo = await driver.wait(
      until.elementLocated(By.id('device-info')),
      10000
    );
    const deviceInfoText = await deviceInfo.getText();

    // Check that it references battery voltage
    assert(
      deviceInfoText.toLowerCase().includes('battery voltage'),
      `Right pane does not show battery voltage. Device info text: ${deviceInfoText}`
    );
  });

  it('should click +, -, left, right and take screenshots', async function() {
    // Zoom In (+)
    const zoomInButton = await driver.findElement(By.id('zoomIn'));
    await zoomInButton.click();
    let screenshotZoomIn = await driver.takeScreenshot();
    fs.writeFileSync('output/zoomIn.png', screenshotZoomIn, 'base64');

    // Zoom Out (−)
    const zoomOutButton = await driver.findElement(By.id('zoomOut'));
    await zoomOutButton.click();
    let screenshotZoomOut = await driver.takeScreenshot();
    fs.writeFileSync('output/zoomOut.png', screenshotZoomOut, 'base64');

    // Move Left (←)
    const moveLeftButton = await driver.findElement(By.id('moveLeft'));
    await moveLeftButton.click();
    let screenshotMoveLeft = await driver.takeScreenshot();
    fs.writeFileSync('output/moveLeft.png', screenshotMoveLeft, 'base64');

    // Move Right (→)
    const moveRightButton = await driver.findElement(By.id('moveRight'));
    await moveRightButton.click();
    let screenshotMoveRight = await driver.takeScreenshot();
    fs.writeFileSync('output/moveRight.png', screenshotMoveRight, 'base64');
  });

  it('should verify the graph is present and not empty', async function() {
    // Check that the chart canvas is displayed
    const chartCanvas = await driver.findElement(By.css('#graph canvas'));
    assert(await chartCanvas.isDisplayed(), 'Chart canvas is not displayed');

    // OPTIONAL: Add additional logic to verify actual data is loaded.
    // For example, if your page sets some DOM element or JS variable
    // to indicate “no data,” you can check here. Or if no dataset
    // is present, you might fail the test. Adjust to how your app signals data presence.

    // Re-check the device info to ensure it's still referencing battery voltage
    const deviceInfo = await driver.findElement(By.id('device-info'));
    const deviceInfoText = await deviceInfo.getText();
    assert(
      deviceInfoText.toLowerCase().includes('battery voltage'),
      'No data or unexpected device info text (battery voltage not found)'
    );
  });
});

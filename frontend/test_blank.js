import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  
  // Just dump the HTML of the body
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log("BODY HTML:");
  console.log(bodyHTML.substring(0, 500) + '...');
  
  const computedStyle = await page.evaluate(() => {
    const el = document.querySelector('.dashboard-main') || document.body;
    const style = window.getComputedStyle(el);
    return {
      bgColor: style.backgroundColor,
      color: style.color
    };
  });
  console.log("COMPUTED STYLES:");
  console.log(computedStyle);
  
  await browser.close();
})();

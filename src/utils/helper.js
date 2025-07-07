const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");

exports.generateTemplateThumbnail = async (content) => {
  // Launch the browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const htmlContent = content;

  await page.setContent(htmlContent);

  await page.setViewport({ width: 250, height: 250 });
  // Apply a zoom-out effect using CSS transform
  const scaleFactor = 0.2; // Adjust this to fit the content into the thumbnail size
  await page.evaluate((scaleFactor) => {
    document.body.style.transform = `scale(${scaleFactor})`;
    document.body.style.transformOrigin = "top left";
    document.body.style.width = `${100 / scaleFactor}%`; // Ensure content fits the scaled viewport
  }, scaleFactor);

  // Capture the screenshot as a Base64 string
  const base64String = await page.screenshot({
    encoding: "base64",
    fullPage: false,
  });
  // Close the browser
  await browser.close();
  console.log("Thumbnail generated");
  return base64String;
};

exports.sendEmail = async (mailDetails) => {
  console.log(mailDetails);
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSKEY,
      },
    });

    const message = {
      from: process.env.EMAIL,
      to: [mailDetails.to],
      subject: mailDetails.subject,
      text: mailDetails.text,
      html: mailDetails.html,
    };

    if (mailDetails.attachment) {
      message.attachments = mailDetails.attachment;
    }

    const mailRes = await transporter.sendMail(message);
    console.log("email Response: ", mailRes);
    return mailRes;
  } catch (error) {
    console.log(Error);
    throw error;
  }
};

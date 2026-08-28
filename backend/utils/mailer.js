const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Prevent a hung SMTP connection from stalling a serverless function indefinitely
  connectionTimeout: 10000,  // 10 s to establish TCP connection
  greetingTimeout:   8000,   // 8 s for SMTP greeting
  socketTimeout:     15000,  // 15 s of inactivity before abort
});

const sendMail = async (to, subject, html, attachments = []) => {
  try {
    const info = await transporter.sendMail({
      from: `"Science & Society" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments
    });
    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

module.exports = { sendMail };

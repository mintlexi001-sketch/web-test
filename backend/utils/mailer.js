const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },

  connectionTimeout: 10000,
  greetingTimeout: 8000,
  socketTimeout: 15000
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

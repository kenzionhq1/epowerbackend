const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendTestEmail = async () => {
  try {
    await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_USER}>`,
      to: "kehindevictor070@gmail.com", // Replace with your email
      subject: "Test Email",
      text: "This is a test email from nodemailer.",
    });
    console.log("✅ Test email sent successfully");
  } catch (err) {
    console.error("❌ Test email error:", err.message);
  }
};



sendTestEmail();
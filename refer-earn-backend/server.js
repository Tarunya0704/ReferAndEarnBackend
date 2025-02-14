
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const cors = require('cors');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// POST endpoint for creating a new referral
app.post('/api/referrals', async (req, res) => {
  try {
    const { referrerName, referrerEmail, refereeName, refereeEmail, course } = req.body;

    // Validate required fields
    if (!referrerName || !referrerEmail || !refereeName || !refereeEmail || !course) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create referral in database
    const referral = await prisma.referral.create({
      data: {
        referrerName,
        referrerEmail,
        refereeName,
        refereeEmail,
        course,
        status: 'PENDING'
      },
    });

    // Send email to referee
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: refereeEmail,
      subject: `${referrerName} has referred you to a course!`,
      html: `
        <h1>You've been referred to a course!</h1>
        <p>Hello ${refereeName},</p>
        <p>${referrerName} thinks you might be interested in our ${course} course.</p>
        <p>Click the link below to learn more:</p>
        <a href="http://yourwebsite.com/courses/${course}">View Course</a>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ 
      message: 'Referral created successfully',
      referral 
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({ error: 'Failed to process referral' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
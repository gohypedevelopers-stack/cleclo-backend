const nodemailer = require('nodemailer');

// SMTP Configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[EMAIL_CONFIG_ERROR] Missing SMTP configuration in .env file. Email alerts will not be sent.');
}

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        if (error.responseCode === 535) {
            console.warn(`[EMAIL_CONFIG_WARNING] SMTP Authentication failed (535) for ${SMTP_HOST}. Please verify your credentials.`);
        } else {
            console.error(`[EMAIL_CONFIG_ERROR] SMTP Connection failed for ${SMTP_HOST}:`, error.message);
        }
    } else {
        console.log(`[EMAIL_SERVICE] Connected to ${SMTP_HOST} - Server is ready`);
    }
});

async function sendLoginAlertEmail(toEmail, alertMessage, ipAddress, location) {
    try {
        const mailOptions = {
            from: `"Cleclo Security" <${SMTP_USER}>`,
            to: toEmail,
            subject: 'Security Alert: New Login Detected',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #3E8940; margin-top: 0;">Cleclo Security Alert</h2>
                    <p>Hello,</p>
                    <p>We noticed a new login to your Cleclo Admin Dashboard.</p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3E8940;">
                        <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase; font-weight: bold;">Login Details</p>
                        <ul style="margin-top: 15px; list-style: none; padding-left: 0;">
                            <li style="margin-bottom: 10px;"><strong>Alert:</strong> ${alertMessage}</li>
                            <li style="margin-bottom: 10px;"><strong>Location:</strong> ${location || 'Gurgaon, India'}</li>
                            <li style="margin-bottom: 10px;"><strong>IP Address:</strong> ${ipAddress || '192.168.1.1'}</li>
                            <li style="margin-bottom: 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                        </ul>
                    </div>
                    <p>If this was you, you can safely ignore this email.</p>
                    <p>If you don't recognize this activity, please contact support immediately and change your password.</p>
                    <br>
                    <p>Stay secure,</p>
                    <p>The Cleclo Team</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL_SENT] Login alert sent to ${toEmail}. Message ID: ${info.messageId}`);
    } catch (error) {
        console.error('[EMAIL_ERROR] Failed to send login alert email:', error);
    }
}

module.exports = {
    sendLoginAlertEmail
};

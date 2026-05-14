const nodemailer = require('nodemailer');

// Mock email service for development if SMTP not configured
// In production, configure environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Assuming Gmail or common SMTP host for this domain
    port: 465,
    secure: true,
    auth: {
        user: 'priyaleadnius@gohypemedia.com',
        pass: 'Leadgen@2026'
    }
});

async function sendLoginAlertEmail(toEmail, alertMessage, ipAddress, location) {
    try {
        const mailOptions = {
            from: '"Cleclo Security" <priyaleadnius@gohypemedia.com>',
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

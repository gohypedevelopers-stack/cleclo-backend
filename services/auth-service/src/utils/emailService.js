const nodemailer = require('nodemailer');

// Mock email service for development if SMTP not configured
// In production, configure environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'etherealpassword'
    }
});

async function sendLoginAlertEmail(toEmail, alertMessage, ipAddress) {
    try {
        const mailOptions = {
            from: process.env.FROM_EMAIL || '"Cleclo Security" <security@cleclo.com>',
            to: toEmail,
            subject: 'Security Alert: New Login Detected',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #3E8940;">Cleclo Security Alert</h2>
                    <p>Hello,</p>
                    <p>We noticed a new login to your Cleclo Admin Dashboard.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 0;"><strong>Details:</strong></p>
                        <ul style="margin-top: 10px;">
                            <li><strong>Alert:</strong> ${alertMessage}</li>
                            <li><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</li>
                            <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
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

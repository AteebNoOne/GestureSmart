import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * EmailService class for handling email operations and verifications
 */
class EmailService {
  constructor() {
    // Get email configuration from environment variables
    this.config = {
      host: process.env.EmailHost,
      port: parseInt(process.env.EmailPort),
      secure: process.env.EmailSecured === 'true',
      auth: {
        user: process.env.EmailUser,
        pass: process.env.EmailPass
      }
    };
    
    // Initialize the transporter
    this.transporter = null;
    if (this.config.host && this.config.port && this.config.auth.user && this.config.auth.pass) {
      this.transporter = nodemailer.createTransport(this.config);
    }
  }

  /**
   * Check if the email service configuration is valid
   * @returns {Promise<Object>} Result of email service verification
   */
  async verifyEmailService() {
    try {
      // Check if necessary configuration is present
      if (!this.config.host) {
        return { 
          status: 'Invalid', 
          reason: 'Email host not configured',
          details: 'EmailHost is missing in environment variables'
        };
      }

      if (!this.config.port) {
        return { 
          status: 'Invalid', 
          reason: 'Email port not configured',
          details: 'EmailPort is missing or invalid in environment variables'
        };
      }

      if (!this.config.auth.user) {
        return { 
          status: 'Invalid', 
          reason: 'Email user not configured',
          details: 'EmailUser is missing in environment variables'
        };
      }

      if (!this.config.auth.pass) {
        return { 
          status: 'Invalid', 
          reason: 'Email password not configured',
          details: 'EmailPass is missing in environment variables'
        };
      }

      // If transporter is null, it means some configuration was missing
      if (!this.transporter) {
        return { 
          status: 'Invalid', 
          reason: 'Email transporter could not be initialized',
          details: 'One or more required configuration parameters are missing'
        };
      }

      // Verify SMTP connection
      const verificationResult = await this.transporter.verify();
      
      if (verificationResult) {
        return { 
          status: 'Connected', 
          reason: 'Email service is properly configured',
          details: {
            host: this.config.host,
            port: this.config.port,
            user: this.config.auth.user ? `${this.config.auth.user.substring(0, 3)}...` : 'Not configured',
            secure: this.config.secure
          }
        };
      } else {
        return { 
          status: 'Invalid', 
          reason: 'Email verification failed',
          details: 'SMTP connection could not be verified'
        };
      }
    } catch (error) {
      return { 
        status: 'Error', 
        reason: 'Email service verification error',
        details: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Send a test email to verify email functionality
   * @param {String} to Recipient email address
   * @returns {Promise<Object>} Result of sending the test email
   */
  async sendTestEmail(to) {
    try {
      if (!this.transporter) {
        return {
          success: false,
          message: 'Email transporter not initialized'
        };
      }

      const info = await this.transporter.sendMail({
        from: this.config.auth.user,
        to,
        subject: `${process.env.APP_NAME || 'Application'} - Test Email`,
        text: 'This is a test email to verify email service functionality.',
        html: '<p>This is a test email to verify email service functionality.</p>'
      });

      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: info.messageId
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`
      };
    }
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;
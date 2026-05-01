import emailjs from '@emailjs/browser';

const PUBLIC_KEY = '2_jx7fcUMJZXTsUT9';
const SERVICE_ID = 'service_0tyi4th';
const TEMPLATE_ID = 'template_bl5034n';

/**
 * Sends a notification email using EmailJS.
 * 
 * @param {string} user_name - Name of the user
 * @param {string} user_email - Email address of the user
 * @param {string} token_number - The token number (e.g., D-001)
 * @param {string} counter_name - The name of the assigned counter
 * @param {string} message - The notification message content
 */
export const sendNotificationEmail = async ({
  user_name,
  user_email,
  token_number,
  counter_name,
  message
}) => {
  try {
    const templateParams = {
      user_name,
      user_email,
      token_number: token_number || 'N/A',
      counter_name: counter_name || 'N/A',
      message,
    };

    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );

    console.log('EmailJS delivery successful');
  } catch (error) {
    console.error('EmailJS delivery failed', error);
  }
};

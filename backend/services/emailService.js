const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

const getConfig = () => ({
  enabled: process.env.EMAILJS_ENABLED === 'true',
  publicKey: process.env.EMAILJS_PUBLIC_KEY || '2_jx7fcUMJZXTsUT9',
  serviceId: process.env.EMAILJS_SERVICE_ID || 'service_0tyi4th',
  templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_jatma2k',
  fromName: process.env.EMAILJS_FROM_NAME || 'Digital Queue Management',
  fallbackRecipient: process.env.EMAILJS_TO_EMAIL || 'hemachandralanka444@gmail.com',
});

const buildTemplateParams = (recipientEmail, tokenData, eventName, extra = {}) => ({
  to_email: recipientEmail,
  customer_email: recipientEmail,
  to_name: extra.customerName || 'Customer',
  event_name: eventName,
  token_number: tokenData.tokenNumber,
  priority_type: tokenData.priorityType || 'normal',
  counter_name: extra.counterName || tokenData.counterName || 'Queue Counter',
  estimated_wait: extra.estimatedWaitMinutes ?? tokenData.estimatedWaitMinutes ?? 0,
  response_deadline: extra.responseDeadline || tokenData.responseDeadline || '',
  feedback_url: extra.feedbackUrl || '',
  reply_to: recipientEmail,
});

const sendEmail = async (eventName, email, tokenData, extra = {}) => {
  const config = getConfig();
  const recipientEmail = extra.overrideRecipient || email || config.fallbackRecipient;

  if (!config.enabled) {
    console.log(`[Email Service] ${eventName} prepared for ${recipientEmail} (EmailJS disabled).`);
    return { delivered: false, reason: 'disabled' };
  }

  if (!config.publicKey || !config.serviceId || !config.templateId) {
    console.log(`[Email Service] ${eventName} skipped for ${recipientEmail} (missing EmailJS configuration).`);
    return { delivered: false, reason: 'missing_configuration' };
  }

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: config.publicKey,
      template_params: {
        ...buildTemplateParams(recipientEmail, tokenData, eventName, extra),
        from_name: config.fromName,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Email Service] ${eventName} failed for ${recipientEmail}: ${errorBody}`);
    return { delivered: false, reason: 'request_failed' };
  }

  console.log(`[Email Service] ${eventName} sent to ${recipientEmail}.`);
  return { delivered: true };
};

const sendTokenGeneratedEmail = (email, tokenData, extra = {}) =>
  sendEmail('token_generated', email, tokenData, extra);

const sendTurnApproachingEmail = (email, tokenData, extra = {}) =>
  sendEmail('turn_approaching', email, tokenData, extra);

const sendTurnAlertEmail = (email, tokenData, extra = {}) =>
  sendEmail('turn_alert', email, tokenData, extra);

const sendServiceCompletedEmail = (email, tokenData, extra = {}) =>
  sendEmail('service_completed', email, tokenData, extra);

const sendFeedbackRequestEmail = (email, tokenData, extra = {}) =>
  sendEmail('feedback_request', email, tokenData, extra);

module.exports = {
  sendTokenGeneratedEmail,
  sendTurnApproachingEmail,
  sendTurnAlertEmail,
  sendServiceCompletedEmail,
  sendFeedbackRequestEmail,
};

import { Mailhooks } from '../src';

async function testWaitForEmail() {
  const mailhooks = new Mailhooks({
    apiKey: process.env.MAILHOOKS_API_KEY || 'your-api-key',
    baseUrl: process.env.MAILHOOKS_BASE_URL || 'https://api.mailhooks.com',
  });

  try {
    // Example 1: Wait for any email from a specific sender (only recent ones)
    console.log('Waiting for email from test@example.com...');
    const email1 = await mailhooks.emails.waitFor({
      filter: { from: 'test@example.com' },
      timeout: 30000, // 30 seconds
      pollInterval: 2000, // Check every 2 seconds
      lookbackWindow: 10000, // Only consider emails from last 10 seconds
    });
    console.log('Received email:', email1.subject);

    // Example 2: Wait for email with specific subject (with initial delay)
    console.log('Waiting for order confirmation email...');
    const email2 = await mailhooks.emails.waitFor({
      filter: { subject: 'Order Confirmation' },
      initialDelay: 5000, // Wait 5 seconds before first check
      timeout: 60000, // 60 seconds total timeout
      pollInterval: 3000, // Check every 3 seconds
      lookbackWindow: 5000, // Only check emails from last 5 seconds on first check
    });
    console.log('Order confirmation received:', email2.id);

    // Example 3: Wait for email to a specific recipient with retry limit
    console.log('Waiting for email to admin@yourdomain.com...');
    const email3 = await mailhooks.emails.waitFor({
      filter: { to: 'admin@yourdomain.com' },
      maxRetries: 10, // Stop after 10 attempts
      pollInterval: 1000, // Check every second
    });
    console.log('Admin email received from:', email3.from);

    // Example 4: Wait for email within a date range
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 1); // 1 hour ago

    console.log('Waiting for recent email...');
    const email4 = await mailhooks.emails.waitFor({
      filter: {
        startDate: startDate.toISOString(),
      },
      timeout: 20000,
    });
    console.log('Recent email found:', email4.subject);

  } catch (error) {
    console.error('Error waiting for email:', error);
  }
}

// Run the test
testWaitForEmail();

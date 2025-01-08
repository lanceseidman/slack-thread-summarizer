const express = require('express');
const express = require('express');
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const OpenAI = require('openai');
require('dotenv').config();

// Create Express app for additional web functionality
const expressApp = express();
const port = process.env.PORT || 3000;

// Initialize Bolt app with Socket Mode
const app = new App({
  token: process.env.SLACK_OAUTH_TOKEN, // Using the OAuth token for bot
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Validate tokens before starting
if (!process.env.SLACK_OAUTH_TOKEN?.startsWith('xoxb-')) {
  throw new Error('SLACK_OAUTH_TOKEN must start with xoxb-');
}

if (!process.env.SLACK_APP_TOKEN?.startsWith('xapp-')) {
  throw new Error('SLACK_APP_TOKEN must start with xapp-');
}

// Also initialize WebClient for additional methods if needed
const slack = new WebClient(process.env.SLACK_OAUTH_TOKEN);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Handle app mentions using Bolt's event handler
app.event('app_mention', async ({ event, say }) => {
  try {
    // Get thread messages
    const result = await app.client.conversations.replies({
      channel: event.channel,
      ts: event.thread_ts || event.ts
    });
    
    const messages = result.messages.map(msg => msg.text).join('\n');
    
    // Generate summary using OpenAI
    const summary = await generateSummary(messages);
    
    // Post summary back to thread
    await say({
      text: `Thread Summary:\n${summary}`,
      thread_ts: event.thread_ts || event.ts
    });
  } catch (error) {
    console.error('Error:', error);
    await say({
      text: 'Sorry, I encountered an error while generating the summary.',
      thread_ts: event.thread_ts || event.ts
    });
  }
});

async function generateSummary(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes Slack conversations concisely and professionally."
        },
        {
          role: "user",
          content: `Please summarize the following Slack thread:\n\n${text}`
        }
      ],
      max_tokens: 300
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'Error generating summary';
  }
}

(async () => {
  // Start the Bolt app with Socket Mode
  await app.start();
  console.log('⚡️ Bolt app started with Socket Mode');
  
  // Start Express server for web interface (optional)
  expressApp.listen(port, () => {
    console.log(`🌐 Web interface available at http://localhost:${port}`);
  });
  
  // Add a simple status endpoint
  expressApp.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Slack Thread Summarizer is running' });
  });
})();

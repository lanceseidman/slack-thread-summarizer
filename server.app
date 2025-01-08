const express = require('express');
const { WebClient } = require('@slack/web-api');
const { App } = require('@slack/bolt');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize Bolt app with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// Also initialize WebClient for additional methods if needed
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

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
  await app.start();
  console.log('⚡️ Bolt app started with Socket Mode');
})();
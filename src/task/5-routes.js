import { namespaceWrapper, app } from "@_koii/namespace-wrapper";
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';

// ES module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname);

// Store feedback
const messageFeedback = [];

// dotenv.config();
// // initialize openai
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const aiContextWindow = [
  {
    role: "system",
    content: "You are the Gordon Gecko of Crypto, and also the Wolf of Wallstreet. Provide accurate advice about DeFi, trading, best tools, best practices and related advice. When users ask about specific token prices or market data, you should use the real-time data provided to you. Keep responses short, concise, and focused on DeFi."
  }
];

// Function to fetch token price from CoinGecko
async function getTokenPrice(tokenId) {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`);
    const data = await response.json();
    return data[tokenId];
  } catch (error) {
    console.error('Error fetching token price:', error);
    return null;
  }
}

// Function to search for token ID
async function searchToken(query) {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${query}`);
    const data = await response.json();
    return data.coins[0]?.id || null;
  } catch (error) {
    console.error('Error searching token:', error);
    return null;
  }
}

// Function to get top DeFi protocols
async function getTopDefiProtocols() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/defi');
    const data = await response.json();
    return data.data.slice(0, 5); // Get top 5 protocols
  } catch (error) {
    console.error('Error fetching DeFi protocols:', error);
    return null;
  }
}

export async function routes() {
  // Serve static files
  app.use(express.static(path.join(__dirname, 'app')));
  app.use(express.json());


  // IF YOU"RE USING THIS TEMPLATE, MAKE SURE TO USE THE NAMESPACEWRAPPERS FS FUNCTION TO GET THE FILES FROM IPFS AS A DOWNLOADABLE FILE
  // route that serves an index.html file
  app.get("/question", async (_req, res) => {
    res.sendFile('index.html', { root: 'D:/_Koii_Projects/CampingAI/0-0-5/src/task/app' });
  });



  // Handle feedback endpoint
  app.post("/api/feedback", async (req, res) => {
    try {
      const { messageId, feedback } = req.body;
      messageFeedback.push({
        messageId,
        feedback,
        timestamp: new Date().toISOString()
      });
      console.log("Feedback received:", { messageId, feedback });
      res.json({ success: true });
    } catch (error) {
      console.error('Error processing feedback:', error);
      res.status(500).json({ error: 'Failed to process feedback' });
    }
  });

  // Handle chat API endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      console.log("MESSAGE RECEIVED:", message);

      // Check if message contains price query
      const priceMatch = message.toLowerCase().match(/price (?:of |for )?([a-zA-Z\s]+)/);
      let marketData = null;

      if (priceMatch) {
        const tokenQuery = priceMatch[1].trim();
        const tokenId = await searchToken(tokenQuery);
        if (tokenId) {
          marketData = await getTokenPrice(tokenId);
        }
      }

      // Add market data to context if available
      if (marketData) {
        aiContextWindow.push({
          role: "system",
          content: `Current market data: ${JSON.stringify(marketData)}`
        });
      }

      aiContextWindow.push({
        role: "user",
        content: message
      });

      // use openai to answer the question
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: aiContextWindow,
        stream: false,
        max_tokens: 500,
      });

      const responseText = response.choices[0].message.content;
      const messageId = Date.now().toString();

      // If we had market data, remove it from context to keep it clean
      if (marketData) {
        aiContextWindow.pop(); // Remove user message
        aiContextWindow.pop(); // Remove market data
        aiContextWindow.push({
          role: "user",
          content: message
        });
      }

      aiContextWindow.push({
        role: "assistant",
        content: responseText
      });

      console.log("AI CONTEXT WINDOW:", aiContextWindow);
      console.log("Response:", responseText, "messageId:", messageId);
      
      res.json({ response: responseText, messageId: messageId });

    } catch (error) {
      console.error('Error processing chat:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  });

  // Endpoint to fetch top performing tokens
  app.get("/api/top-tokens", async (_req, res) => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' +
        'vs_currency=usd&' +
        'order=price_change_percentage_24h_desc&' +  // Sort by 24h performance
        'per_page=5&' +  // Get top 5 tokens
        'page=1&' +
        'sparkline=false&' +
        'price_change_percentage=24h&' +
        'locale=en'
      );
      
      const data = await response.json();
      
      // Format the data we need
      const formattedData = data.map(token => ({
        symbol: token.symbol.toUpperCase(),
        price: token.current_price,
        change_24h: token.price_change_percentage_24h,
        fdv: token.fully_diluted_valuation
      }));
      
      res.json(formattedData);
    } catch (error) {
      console.error('Error fetching top tokens:', error);
      res.status(500).json({ error: 'Failed to fetch top tokens' });
    }
  });

  // Endpoint to fetch token prices for market overview
  app.get("/api/market-prices", async (req, res) => {
    try {
      const tokens = req.query.tokens || 'bitcoin,ethereum'; // Default to BTC and ETH
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokens}&vs_currencies=usd&include_24hr_change=true`
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching market prices:', error);
      res.status(500).json({ error: 'Failed to fetch market prices' });
    }
  });

  // Endpoint to fetch available tokens
  app.get("/api/available-tokens", async (_req, res) => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' +
        'vs_currency=usd&' +
        'order=market_cap_desc&' +  // Sort by market cap
        'per_page=100&' +  // Get top 100 tokens
        'page=1&' +
        'sparkline=false'
      );
      
      const data = await response.json();
      
      // Format the data we need
      const formattedData = data.map(token => ({
        id: token.id,
        symbol: token.symbol.toUpperCase(),
        name: token.name,
        market_cap_rank: token.market_cap_rank
      }));
      
      res.json(formattedData);
    } catch (error) {
      console.error('Error fetching available tokens:', error);
      res.status(500).json({ error: 'Failed to fetch available tokens' });
    }
  });

  // Endpoint to search for tokens
  app.get("/api/search-tokens", async (req, res) => {
    try {
      const query = req.query.query;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
      );
      
      const data = await response.json();
      
      // Format the search results
      const formattedData = data.coins.map(token => ({
        id: token.id,
        symbol: token.symbol.toUpperCase(),
        name: token.name
      }));
      
      res.json(formattedData);
    } catch (error) {
      console.error('Error searching tokens:', error);
      res.status(500).json({ error: 'Failed to search tokens' });
    }
  });
}

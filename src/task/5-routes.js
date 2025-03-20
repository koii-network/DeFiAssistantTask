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

// Function to get user's portfolio data
async function getUserPortfolio() {
  try {
    // Get tracked tokens from localStorage
    const trackedTokens = JSON.parse(localStorage.getItem('trackedTokens') || '[]');
    if (trackedTokens.length === 0) return null;

    // Get token amounts from localStorage
    const tokenAmounts = {};
    trackedTokens.forEach(tokenId => {
      const amount = localStorage.getItem(`token_amount_${tokenId}`);
      if (amount) tokenAmounts[tokenId] = parseFloat(amount);
    });

    // Get current prices
    const tokenList = trackedTokens.join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenList}&vs_currencies=usd&include_24hr_change=true`
    );
    const prices = await response.json();

    // Calculate portfolio metrics
    let totalValue = 0;
    let totalChange = 0;
    let assetCount = 0;
    const assets = [];

    trackedTokens.forEach(tokenId => {
      const tokenData = prices[tokenId];
      if (tokenData && tokenData.usd) {
        const amount = tokenAmounts[tokenId] || 0;
        if (amount > 0) {
          const value = tokenData.usd * amount;
          totalValue += value;
          totalChange += tokenData.usd_24h_change;
          assetCount++;
          assets.push({
            id: tokenId,
            amount: amount,
            price: tokenData.usd,
            value: value,
            change_24h: tokenData.usd_24h_change
          });
        }
      }
    });

    const avgChange = assetCount > 0 ? totalChange / assetCount : 0;

    return {
      totalValue,
      totalChange: avgChange,
      assetCount,
      totalTokens: Object.values(tokenAmounts).reduce((a, b) => a + b, 0),
      assets
    };
  } catch (error) {
    console.error('Error getting portfolio data:', error);
    return null;
  }
}

// Function to fetch and analyze Google News results
async function analyzeTokenNews(tokenQuery) {
  try {
    // Fetch news from Google News API
    const response = await fetch(
      `https://newsapi.org/v2/everything?` +
      `q=${encodeURIComponent(tokenQuery + ' cryptocurrency')}&` +
      `language=en&` +
      `sortBy=publishedAt&` +
      `pageSize=10&` +
      `apiKey=${process.env.NEWS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (!data.articles || data.articles.length === 0) {
      return null;
    }

    // Extract relevant information from articles
    const articles = data.articles.map(article => ({
      title: article.title,
      description: article.description,
      source: article.source.name,
      publishedAt: article.publishedAt,
      sentiment: analyzeSentiment(article.title + ' ' + article.description)
    }));

    // Calculate overall sentiment
    const overallSentiment = calculateOverallSentiment(articles);
    
    // Generate analysis summary
    const analysis = {
      token: tokenQuery,
      sentiment: overallSentiment,
      articleCount: articles.length,
      articles: articles,
      summary: generateSentimentSummary(overallSentiment, articles)
    };

    return analysis;
  } catch (error) {
    console.error('Error analyzing news:', error);
    return null;
  }
}

// Function to analyze sentiment of text
function analyzeSentiment(text) {
  // Simple sentiment analysis based on keyword matching
  const positiveWords = ['surge', 'rise', 'gain', 'up', 'high', 'bullish', 'growth', 'positive', 'increase', 'rally'];
  const negativeWords = ['drop', 'fall', 'down', 'low', 'bearish', 'decline', 'negative', 'decrease', 'crash', 'risk'];
  
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score++;
    if (negativeWords.includes(word)) score--;
  });
  
  return {
    score,
    sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
  };
}

// Function to calculate overall sentiment from multiple articles
function calculateOverallSentiment(articles) {
  const totalScore = articles.reduce((sum, article) => sum + article.sentiment.score, 0);
  const averageScore = totalScore / articles.length;
  
  return {
    score: averageScore,
    sentiment: averageScore > 0.2 ? 'positive' : averageScore < -0.2 ? 'negative' : 'neutral',
    strength: Math.abs(averageScore)
  };
}

// Function to generate a summary of the sentiment analysis
function generateSentimentSummary(overallSentiment, articles) {
  const sentimentStrength = overallSentiment.strength;
  const sentiment = overallSentiment.sentiment;
  
  let summary = `Based on recent news analysis for ${articles[0].token}:\n`;
  
  if (sentimentStrength < 0.3) {
    summary += "The market sentiment is mixed with no clear direction.\n";
  } else if (sentiment === 'positive') {
    summary += `The market sentiment is moderately to strongly positive (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
  } else if (sentiment === 'negative') {
    summary += `The market sentiment is moderately to strongly negative (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
  }
  
  // Add key points from articles
  const keyPoints = articles
    .filter(article => Math.abs(article.sentiment.score) > 1)
    .map(article => `- ${article.title}`)
    .slice(0, 3);
  
  if (keyPoints.length > 0) {
    summary += "\nKey recent developments:\n" + keyPoints.join('\n');
  }
  
  return summary;
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
      const { message, portfolio } = req.body;
      console.log("MESSAGE RECEIVED:", message);
      console.log("PORTFOLIO RECEIVED:", portfolio);
      
      // Create portfolio context from received portfolio data
      let portfolioContext = "";
      if (portfolio && portfolio.assets && portfolio.assets.length > 0) {
        portfolioContext = `User's Portfolio Information:
- Total Value: $${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- 24h Change: ${portfolio.totalChange.toFixed(2)}%
- Number of Assets: ${portfolio.assetCount}
- Total Tokens: ${portfolio.totalTokens.toLocaleString('en-US', { maximumFractionDigits: 2 })}

Assets:
${portfolio.assets.map(asset => `- ${asset.id}: ${asset.amount} tokens ($${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - 24h: ${asset.change_24h.toFixed(2)}%`).join('\n')}`;
      }

      // Check for trading advice queries
      const tradingAdviceMatch = message.toLowerCase().match(/(?:should|would|do you think) (?:i|you) (?:buy|sell|invest in|trade) (?:more|some|any) ([a-zA-Z\s]+)/);
      let newsAnalysis = null;

      if (tradingAdviceMatch) {
        const tokenQuery = tradingAdviceMatch[1].trim();
        newsAnalysis = await analyzeTokenNews(tokenQuery);
      }

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

      // Add market data, portfolio, and news analysis to context if available
      if (marketData) {
        aiContextWindow.push({
          role: "system",
          content: `Current market data: ${JSON.stringify(marketData)}`
        });
        console.log("\n=== Added Market Data to Context ===");
        console.log(JSON.stringify(marketData, null, 2));
      }

      if (portfolioContext) {
        aiContextWindow.push({
          role: "system",
          content: portfolioContext
        });
        console.log("\n=== Added Portfolio Context ===");
        console.log(portfolioContext);
      }

      if (newsAnalysis) {
        aiContextWindow.push({
          role: "system",
          content: `Recent market sentiment analysis:\n${newsAnalysis.summary}`
        });
        console.log("\n=== Added News Analysis ===");
        console.log(newsAnalysis.summary);
      }

      aiContextWindow.push({
        role: "user",
        content: message
      });

      console.log("\n=== Full AI Context Window ===");
      console.log(JSON.stringify(aiContextWindow, null, 2));

      // use openai to answer the question
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: aiContextWindow,
        stream: false,
        max_tokens: 500,
      });

      const responseText = response.choices[0].message.content;
      const messageId = Date.now().toString();

      // Clean up context
      if (marketData || portfolioContext || newsAnalysis) {
        aiContextWindow.pop(); // Remove user message
        if (marketData) aiContextWindow.pop(); // Remove market data
        if (portfolioContext) aiContextWindow.pop(); // Remove portfolio context
        if (newsAnalysis) aiContextWindow.pop(); // Remove news analysis
        aiContextWindow.push({
          role: "user",
          content: message
        });
      }

      aiContextWindow.push({
        role: "assistant",
        content: responseText
      });

      console.log("\n=== AI Response ===");
      console.log(responseText);
      console.log("\n=== Message ID ===");
      console.log(messageId);
      
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

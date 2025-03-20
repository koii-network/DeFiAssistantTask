import { namespaceWrapper, app } from "@_koii/namespace-wrapper";
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';

/**
 * DeFi AI Assistant with News Analysis
 * 
 * IMPORTANT: To enable news analysis functionality, you must:
 * 1. Sign up for a free API key at https://newsapi.org/
 * 2. Create a .env file in the project root with: NEWS_API_KEY=your_api_key_here
 * 3. Restart the server after adding the API key
 * 
 * The AI can now respond to commands like:
 * - "look up bitcoin"
 * - "search for ethereum news"
 * - "check information about solana"
 * 
 * These will trigger sentiment analysis of recent news articles.
 */

// ES module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname);

// Store feedback
const messageFeedback = [];

// Load environment variables from .env file
dotenv.config();

// Check if NEWS_API_KEY is configured
if (!process.env.NEWS_API_KEY) {
  console.warn("⚠️ NEWS_API_KEY not found in environment variables");
  console.warn("News analysis functionality will not work until you configure an API key");
  console.warn("Get a free API key from https://newsapi.org/ and add it to your .env file");
}

// initialize openai
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
    console.log(`Starting news analysis for token: ${tokenQuery}`);
    
    // Check if API key is available
    if (!process.env.NEWS_API_KEY) {
      console.error("NEWS_API_KEY is not set in environment variables");
      throw new Error("NEWS_API_KEY not configured");
    }
    
    // Fetch news from Google News API
    const apiUrl = `https://newsapi.org/v2/everything?` +
      `q=${encodeURIComponent(tokenQuery + ' cryptocurrency')}&` +
      `language=en&` +
      `sortBy=publishedAt&` +
      `pageSize=10&` +
      `apiKey=${process.env.NEWS_API_KEY}`;
    
    console.log(`Fetching news from URL: ${apiUrl.replace(process.env.NEWS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`News API responded with status: ${response.status}`);
      const errorText = await response.text();
      console.error(`Response body: ${errorText}`);
      throw new Error(`News API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Received news data: ${data.totalResults} results`);
    
    if (!data.articles || data.articles.length === 0) {
      console.warn(`No articles found for query: ${tokenQuery}`);
      return null;
    }

    // Extract relevant information from articles
    const articles = data.articles.map(article => ({
      title: article.title || '',
      description: article.description || '',
      source: article.source?.name || 'Unknown',
      publishedAt: article.publishedAt,
      url: article.url,
      sentiment: analyzeSentiment((article.title || '') + ' ' + (article.description || ''))
    }));

    // Log sentiment results for debugging
    articles.forEach((article, i) => {
      console.log(`Article ${i+1} sentiment: ${article.sentiment.sentiment} (score: ${article.sentiment.score})`);
      console.log(`Title: ${article.title.substring(0, 50)}...`);
    });

    // Calculate overall sentiment
    const overallSentiment = calculateOverallSentiment(articles);
    console.log(`Overall sentiment: ${overallSentiment.sentiment} (score: ${overallSentiment.score}, trend: ${overallSentiment.trend})`);
    
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
  // Enhanced sentiment analysis based on keyword matching
  const positiveWords = [
    'surge', 'rise', 'gain', 'up', 'high', 'bullish', 'growth', 'positive', 'increase', 'rally', 
    'soar', 'climb', 'jump', 'spike', 'breakthrough', 'outperform', 'beat', 'exceed', 'moon', 'rocket',
    'adoption', 'partnership', 'launch', 'success', 'profit', 'win', 'recover', 'support', 'upgrade',
    'innovation', 'potential', 'opportunity', 'milestone', 'progress', 'revolutionize', 'disrupt',
    'mainstream', 'institutional', 'hodl', 'hold', 'buy', 'accumulate'
  ];
  
  const negativeWords = [
    'drop', 'fall', 'down', 'low', 'bearish', 'decline', 'negative', 'decrease', 'crash', 'risk',
    'plunge', 'tumble', 'sink', 'slide', 'slump', 'dip', 'correction', 'sell-off', 'dump', 'panic',
    'fear', 'uncertain', 'concern', 'worry', 'warning', 'threat', 'problem', 'issue', 'trouble',
    'scam', 'hack', 'fraud', 'attack', 'vulnerability', 'regulation', 'ban', 'restrict', 'illegal',
    'fine', 'penalty', 'investigation', 'litigation', 'lawsuit', 'bearish', 'short', 'sell'
  ];
  
  // Normalize text
  const lowerText = text.toLowerCase();
  const words = lowerText.match(/\b(\w+)\b/g) || [];
  let score = 0;
  let posMatches = [];
  let negMatches = [];
  
  // Calculate sentiment score with more nuanced weighting
  words.forEach(word => {
    if (positiveWords.includes(word)) {
      score += 1;
      posMatches.push(word);
    }
    if (negativeWords.includes(word)) {
      score -= 1;
      negMatches.push(word);
    }
  });
  
  // Adjust for phrases that might indicate stronger sentiment
  if (lowerText.includes('all time high') || lowerText.includes('ath')) score += 2;
  if (lowerText.includes('all time low') || lowerText.includes('atl')) score -= 2;
  if (lowerText.includes('to the moon')) score += 2;
  if (lowerText.includes('massive gain')) score += 2;
  if (lowerText.includes('massive drop') || lowerText.includes('massive loss')) score -= 2;
  
  // Check for negation that might reverse sentiment
  ['not', 'no', "n't", 'never', 'without'].forEach(negation => {
    const negationRegex = new RegExp(`${negation} \\w+ (${positiveWords.join('|')})`, 'gi');
    const matches = lowerText.match(negationRegex) || [];
    score -= matches.length * 2; // Double subtraction to reverse the positive term and add negative sentiment
    
    const negationRegexNeg = new RegExp(`${negation} \\w+ (${negativeWords.join('|')})`, 'gi');
    const matchesNeg = lowerText.match(negationRegexNeg) || [];
    score += matchesNeg.length * 2; // Double addition to reverse the negative term and add positive sentiment
  });
  
  return {
    score,
    sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
    positiveMatches: posMatches.length > 0 ? [...new Set(posMatches)] : [],
    negativeMatches: negMatches.length > 0 ? [...new Set(negMatches)] : []
  };
}

// Function to calculate overall sentiment from multiple articles
function calculateOverallSentiment(articles) {
  if (!articles || articles.length === 0) {
    return { score: 0, sentiment: 'neutral', strength: 0, trend: 'stable' };
  }
  
  // Sort articles by date - most recent first
  const sortedArticles = [...articles].sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  
  // Calculate weighted scores - more recent articles get higher weight
  let totalScore = 0;
  let totalWeight = 0;
  const weights = [];
  const weightedScores = [];
  
  // Generate weights based on recency (most recent gets highest weight)
  for (let i = 0; i < sortedArticles.length; i++) {
    // Weight formula: most recent is 1.0, decreasing by 0.1 for older articles (minimum 0.2)
    const weight = Math.max(1.0 - (i * 0.1), 0.2);
    weights.push(weight);
    totalWeight += weight;
  }
  
  // Calculate weighted score
  for (let i = 0; i < sortedArticles.length; i++) {
    const weightedScore = sortedArticles[i].sentiment.score * weights[i];
    weightedScores.push(weightedScore);
    totalScore += weightedScore;
  }
  
  const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  
  // Determine trend by comparing recent vs older articles
  let trend = 'stable';
  if (sortedArticles.length >= 3) {
    // Calculate average of most recent third vs oldest third
    const thirdSize = Math.max(1, Math.floor(sortedArticles.length / 3));
    const recentThird = sortedArticles.slice(0, thirdSize);
    const oldestThird = sortedArticles.slice(-thirdSize);
    
    const recentAvg = recentThird.reduce((sum, article) => sum + article.sentiment.score, 0) / recentThird.length;
    const oldestAvg = oldestThird.reduce((sum, article) => sum + article.sentiment.score, 0) / oldestThird.length;
    
    const difference = recentAvg - oldestAvg;
    if (difference > 1) trend = 'improving';
    else if (difference < -1) trend = 'deteriorating';
  }
  
  return {
    score: averageScore,
    sentiment: averageScore > 0.2 ? 'positive' : averageScore < -0.2 ? 'negative' : 'neutral',
    strength: Math.abs(averageScore),
    trend: trend
  };
}

// Function to generate a summary of the sentiment analysis
function generateSentimentSummary(overallSentiment, articles) {
  const sentimentStrength = overallSentiment.strength;
  const sentiment = overallSentiment.sentiment;
  const trend = overallSentiment.trend;
  
  let summary = `Recent News Analysis:\n`;
  let priceOutlook = "";
  let trendAnalysis = "";
  
  // Sentiment analysis with more detailed price outlook
  if (sentimentStrength < 0.3) {
    summary += "The market sentiment is mixed with no clear direction.\n";
    priceOutlook = "The token price may remain relatively stable in the short term due to balanced sentiment.";
  } else if (sentiment === 'positive') {
    if (sentimentStrength > 0.6) {
      summary += `The market sentiment is strongly positive (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
      priceOutlook = "This highly positive sentiment could potentially drive price increases in the short term.";
    } else {
      summary += `The market sentiment is moderately positive (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
      priceOutlook = "This positive sentiment may contribute to gradual price appreciation.";
    }
  } else if (sentiment === 'negative') {
    if (sentimentStrength > 0.6) {
      summary += `The market sentiment is strongly negative (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
      priceOutlook = "This highly negative sentiment could potentially lead to price decreases in the short term.";
    } else {
      summary += `The market sentiment is moderately negative (${(sentimentStrength * 100).toFixed(1)}% confidence).\n`;
      priceOutlook = "This negative sentiment may contribute to gradual price depreciation.";
    }
  }
  
  // Add trend analysis
  if (trend === 'improving') {
    trendAnalysis = "The sentiment trend is improving, with more recent news being more positive than older articles.";
    if (sentiment === 'negative') {
      trendAnalysis += " This could indicate a potential recovery or reversal of negative sentiment.";
    } else {
      trendAnalysis += " This reinforces the positive outlook.";
    }
  } else if (trend === 'deteriorating') {
    trendAnalysis = "The sentiment trend is deteriorating, with more recent news being more negative than older articles.";
    if (sentiment === 'positive') {
      trendAnalysis += " This might indicate a weakening of the previously positive outlook.";
    } else {
      trendAnalysis += " This reinforces the negative outlook.";
    }
  } else {
    trendAnalysis = "The sentiment trend is stable with no significant changes between recent and older articles.";
  }
  
  // Add price outlook and trend analysis
  summary += priceOutlook + "\n\n" + trendAnalysis + "\n\n";
  
  // Add key points from articles with publication dates
  const keyPoints = articles
    .filter(article => Math.abs(article.sentiment.score) > 1)
    .map(article => {
      const date = new Date(article.publishedAt);
      const dateStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `- [${dateStr}] ${article.title} (Source: ${article.source})`;
    })
    .slice(0, 5);
  
  if (keyPoints.length > 0) {
    summary += "Key recent developments:\n" + keyPoints.join('\n');
  }
  
  // Add disclaimer
  summary += "\n\nNote: This sentiment analysis is based on recent news and should not be considered financial advice.";
  
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
      
      // Check for google search or look up queries - improved regex pattern for better matching
      const searchQueryMatch = message.toLowerCase().match(/(?:google\s*search|look\s*up|search\s*for|research|check|find|news\s*about|information\s*about)\s+(?:about\s+|info\s+|information\s+|news\s+|)(?:on\s+|about\s+|for\s+|)([a-zA-Z0-9\s]+)/i);
      
      console.log("Message:", message);
      if (searchQueryMatch) {
        console.log("Search query match found:", searchQueryMatch[0]);
        console.log("Token to research:", searchQueryMatch[1].trim());
      } else {
        console.log("No search query match found in message");
      }
      
      let newsAnalysis = null;

      if (tradingAdviceMatch) {
        const tokenQuery = tradingAdviceMatch[1].trim();
        console.log("Trading advice query detected for token:", tokenQuery);
        newsAnalysis = await analyzeTokenNews(tokenQuery);
      } else if (searchQueryMatch) {
        const tokenQuery = searchQueryMatch[1].trim();
        console.log("Performing news search for token:", tokenQuery);
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
          content: `Recent market sentiment analysis for ${searchQueryMatch ? "your search query about" : ""} ${tradingAdviceMatch ? "your trading question about" : ""} ${newsAnalysis.token}:\n${newsAnalysis.summary}`
        });
        console.log("\n=== Added News Analysis ===");
        console.log(newsAnalysis.summary);
      } else if (searchQueryMatch && !process.env.NEWS_API_KEY) {
        // If search was requested but API key is missing, add a special note to the context
        aiContextWindow.push({
          role: "system",
          content: `Note: The user has requested to search for news about "${searchQueryMatch[1].trim()}", but the NEWS_API_KEY is not configured. Please inform them that you don't have access to real-time news data at the moment, but you can still provide general information.`
        });
        console.log("\n=== Added API Key Missing Notice ===");
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

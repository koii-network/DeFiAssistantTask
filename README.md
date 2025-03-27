# Koii DeFi AI Assistant API

## Project Overview

This project is a decentralized AI assistant task built on the Koii Network, designed to provide an interactive API endpoint for AI-powered assistance. The primary purpose is to demonstrate a blockchain-based task that leverages AI capabilities within a decentralized computing environment.

### Key Features
- AI-powered question answering
- Decentralized task execution
- Blockchain-based reward mechanism
- Flexible task round management

## Getting Started

### Prerequisites
- Node.js (version >=20.0.0, LTS Versions only)
- Yarn package manager
- OpenAI API key (for AI functionality)

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/your-org/koii-defi-ai-assistant.git
cd koii-defi-ai-assistant
```

2. Install dependencies:
```bash
yarn install
```

3. Configure environment variables:
- Copy `.env.developer.example` to `.env`
- Add your OpenAI API key:
```
OPENAI_API_KEY="your_openai_api_key_here"
```

4. Start the development server:
```bash
yarn start
```

## API Documentation

### Endpoint Details
- **Endpoint:** `/task/{task-id}/question`
- **Method:** POST
- **Content-Type:** application/json

#### Request Payload
```json
{
  "question": "Your AI query here"
}
```

#### Response
```json
{
  "answer": "AI-generated response",
  "metadata": {
    "timestamp": "2024-01-30T12:18:42Z",
    "taskId": "FGzVTXn6iZFhFo9FgWW6zoHfDkJepQkKKKPfMvDdvePv"
  }
}
```

## Authentication

This task uses a decentralized authentication mechanism through the Koii Network's task registration process. No traditional API key is required.

## Project Structure

```
├── src/
│   ├── task/
│   │   ├── 0-setup.js      # Initial task setup
│   │   ├── 1-task.js       # Core task logic
│   │   ├── 2-submission.js # Submission handling
│   │   ├── 3-audit.js      # Work auditing
│   │   ├── 4-distribution.js # Reward distribution
│   │   └── 5-routes.js     # Custom API routes
│   └── index.js            # Application entry point
├── tests/                  # Testing utilities
├── config-task.yml         # Task configuration
└── package.json            # Project metadata and scripts
```

## Technologies Used

- Node.js
- Koii Network Task Framework
- OpenAI API
- Web3.js
- Webpack
- Jest (testing)

## Deployment

### Local Testing
```bash
# Simulate full task round cycle
yarn simulate

# Production debugging
yarn prod-debug
```

### Network Deployment
1. Configure `config-task.yml`
2. Use Koii Create Task CLI:
```bash
npx @_koii/create-task-cli@latest
```

## Development Modes

- `GLOBAL_TIMERS="true"`: Automated IPC calls
- `GLOBAL_TIMERS="false"`: Manual K2 transaction management

## License

This project is licensed under the ISC License.

## Support

For issues or questions, please open a ticket on [Koii Network Discord](https://discord.gg/koii-network).

---

*Powered by Koii Network - Decentralized Computing Made Simple*
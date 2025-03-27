# Koii DeFi AI Assistant

![Task Flowchart](Screenshot%202025-01-30%20121842.png)

## Project Overview

This project is a decentralized AI-powered assistant built on the Koii Network, designed to provide intelligent interactions and services through a blockchain-based infrastructure. The application leverages OpenAI's capabilities within a distributed computing environment.

Key features include:
- Decentralized AI task execution
- Blockchain-based interaction model
- Flexible task management and incentive distribution
- Scalable and secure task framework

## Technologies Used

- **Runtime**: Node.js (v20.0.0+)
- **Blockchain**: Koii Network
- **AI Integration**: OpenAI
- **Build Tools**: Webpack, Babel
- **Testing**: Jest
- **Deployment**: Koii Task CLI

## Getting Started

### Prerequisites

- Node.js (version >=20.0.0, LTS Versions)
- Yarn package manager
- OpenAI API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/koii-ai-assistant.git
   cd koii-ai-assistant
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

### Development

Run the development server:
```bash
yarn start
```

Access the application endpoint:
- Local Endpoint: `http://localhost:30017/task/FGzVTXn6iZFhFo9FgWW6zoHfDkJepQkKKKPfMvDdvePv/question`

## Project Structure

```
├── src/
│   ├── task/              # Core task logic and implementations
│   │   ├── 0-setup.js     # Initial task setup
│   │   ├── 1-task.js      # Main task logic
│   │   ├── 2-submission.js# Task submission handling
│   │   ├── 3-audit.js     # Work auditing
│   │   ├── 4-distribution.js # Reward distribution
│   │   └── 5-routes.js    # Custom route definitions
│   └── index.js           # Application entry point
├── tests/                 # Testing utilities and configurations
├── config-task.yml        # Task configuration
└── package.json           # Project dependencies and scripts
```

## Testing

Run different test scenarios:

1. Core Logic Test:
   ```bash
   yarn test
   ```

2. Full Task Simulation:
   ```bash
   yarn simulate
   ```

3. Production Debugging:
   ```bash
   yarn prod-debug
   ```

## Deployment

### Build for Production

1. Create production build:
   ```bash
   yarn webpack:prod
   ```

2. Deploy using Koii Task CLI:
   ```bash
   npx @_koii/create-task-cli@latest
   ```

### Configuration

Key configuration options are managed through:
- `.env` files for environment-specific settings
- `config-task.yml` for task deployment parameters

## Feature Highlights

- Decentralized AI task execution
- Blockchain-based proof submission
- Automatic work auditing
- Reward and penalty distribution mechanism
- Flexible task round management

## Advanced Runtime Options

Two execution modes are supported:
1. `GLOBAL_TIMERS="true"`: Automatic IPC call synchronization
2. `GLOBAL_TIMERS="false"`: Manual K2 transaction management

## Troubleshooting

- Ensure Node.js version compatibility
- Verify OpenAI API key configuration
- Check network connectivity

For additional support, join the [Koii Network Discord](https://discord.gg/koii-network)

## License

This project is licensed under the ISC License. See the LICENSE file for details.

---

*Powered by Koii Network - Decentralizing the Future* 🚀
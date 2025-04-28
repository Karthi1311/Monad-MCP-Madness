# Monad Blockchain: Testnet and MCP Development Guide  

## Table of Contents  
- [Overview of Monad Blockchain](#overview-of-monad-blockchain)  
- [Monad Testnet](#monad-testnet)  
  - [Setting Up a Monad Node](#setting-up-a-monad-node)  
  - [Deploying Smart Contracts](#deploying-smart-contracts)  
  - [Testnet Tools (Wallet, Faucet, Explorer)](#testnet-tools-wallet-faucet-explorer)  
- [MCP Development on Monad](#mcp-development-on-monad)  
  - [Setting Up an MCP Server](#setting-up-an-mcp-server)  
  - [Best Practices for MCP Tools](#best-practices-for-mcp-tools)  
  - [Integration with Claude Desktop and Cursor IDE](#integration-with-claude-desktop-and-cursor-ide)  
- [Bonus Tips](#bonus-tips)  
  - [Easy Installation of MCP Servers](#easy-installation-of-mcp-servers)  
  - [Achieving More with Fewer Prompts](#achieving-more-with-fewer-prompts)  

## Overview of Monad Blockchain  

Monad is a next-generation Layer-1 blockchain that is **100% EVM-compatible** while delivering extremely high throughput ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=Speed%20without%20sacrifice,Monad)) ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Build%20without%20constraints)). According to its developers, the protocol achieves **“breakthrough performance”** with up to **10,000 transactions per second** and single-second block finality ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=Speed%20without%20sacrifice,Monad)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=What%20is%20the%20average%20throughput,of%20Monad%20Network)). This performance is enabled by advanced consensus and execution designs: **Optimistic Parallel Execution** and **Asynchronous Execution** decouple transaction execution from consensus, allowing many independent transactions to run in parallel ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=Monad%20leverages%20Optimistic%20Parallel%20Execution%2C,scalable%2C%20and%20considerably%20cheaper%20blockchain)) ([Asynchronous Execution | Monad Developer Documentation](https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution#block-states#:~:text=Asynchronous%20Execution%20is%20a%20technique,by%20decoupling%20consensus%20from%20execution)). In practice, nodes come to consensus on a block’s order, and then execute the transactions (often in parallel) without blocking consensus ([Asynchronous Execution | Monad Developer Documentation](https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution#block-states#:~:text=Asynchronous%20Execution%20is%20a%20technique,by%20decoupling%20consensus%20from%20execution)).  

At the core of Monad’s design is **MonadDB**, a custom database that stores state. MonadDB uses an Ethereum-like state structure but optimizes storage by keeping most data on SSD rather than RAM ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=MonadDB%20is%20a%20custom%20database,optimized%20networks)) ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=)). This allows full parallel execution of transactions without the huge RAM requirements of other chains. In fact, the Monad architecture guidelines note that nodes can store much of the blockchain state on SSD (solid-state storage), **“significantly reduc[ing] RAM requirements”** ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=)). Together with its novel **MonadBFT** consensus (which is fork-resistant) and other protocol improvements, these optimizations let Monad **solve the blockchain trilemma**, offering high speed and security without sacrificing decentralization ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=Speed%20without%20sacrifice,Monad)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=Monad%20leverages%20Optimistic%20Parallel%20Execution%2C,scalable%2C%20and%20considerably%20cheaper%20blockchain)). All Ethereum tooling – **Foundry, Hardhat, MetaMask, Phantom**, etc. – works natively on Monad due to this full EVM compatibility ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=,designed%20for%20Ethereum)) ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Build%20without%20constraints)).  

In summary, Monad’s goal is to provide an **EVM-equivalent development environment** with far higher throughput and lower fees than existing chains.  By retaining Ethereum’s execution semantics and bytecode standard, Monad maximizes compatibility (all Solidity smart contracts and Ethereum libraries can be reused), while its parallel and asynchronous execution engines dramatically boost performance ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=,designed%20for%20Ethereum)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=What%20is%20the%20average%20throughput,of%20Monad%20Network)). The net result is an L1 blockchain that can handle thousands of transactions per second with near-zero gas fees and one-second finality, effectively “say[ing] goodbye to the blockchain trilemma” ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=Speed%20without%20sacrifice,Monad)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=What%20is%20the%20average%20throughput,of%20Monad%20Network)).  

## Monad Testnet  

The **Monad Testnet** is a public test network where developers can build and experiment before mainnet launch. It provides all the features of the main chain – same consensus and execution logic – in a sandboxed environment. The testnet is intended for deploying dApps, testing contracts, and iterating on tools without real funds. As the official developer portal notes, **“Everything you need to deploy on Monad Testnet, from the faucet, network details and explorer, we got you.”** ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Everything%20you%20need%20to%20deploy,and%20explorer%2C%20we%20got%20you)).  

The testnet runs on **Chain ID 10143** (an arbitrarily chosen ID), and the native token is called **MON**.  To connect a wallet (e.g. MetaMask or other Ethereum-compatible wallets), one adds a custom network with name “Monad Testnet”, RPC URL `https://testnet-rpc.monad.xyz`, Chain ID **10143**, and currency symbol **MON**. (For example, third-party references confirm: Chain ID 10143, Symbol MON ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Chain%20ID)).)  Once configured, the testnet wallet can send transactions and deploy contracts just like on any Ethereum testnet.  

### Setting Up a Monad Node  

To run your own full node on Monad Testnet (e.g. for participating as a validator or for development access), you must install the official Monad node software and sync the chain.  Hardware requirements are substantial: the developer docs recommend a **16‑core CPU (4.5+ GHz)**, **32 GB RAM**, and **NVMe SSD storage** (two 2 TB SSDs, one for the MonadDB state) ([Hardware Requirements | Monad Developer Documentation](https://docs.monad.xyz/monad-arch/hardware-requirements#:~:text=The%20following%20hardware%20requirements%20are,run%20a%20Monad%20full%20node)).  However, thanks to MonadDB’s design, much of the state is stored on disk, **“significantly reduc[ing] RAM requirements”** ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=)). After installing the binary (or building from source, once available on the Monad GitHub), one configures it for testnet (using Chain ID 10143 and the official bootnodes).  When the node starts, it will connect to peers and download the testnet blockchain. Note that because Monad executes in parallel, even syncing the chain can take advantage of multi-core hardware for speed.  

In practice, detailed node setup instructions are provided by the Monad Foundation’s developer documentation.  One should join the official Discord or developer channels for up-to-date guides.  In general, the steps are: (1) ensure your system meets the above hardware specs; (2) download or compile the Monad node client; (3) configure it to use `testnet-rpc.monad.xyz` or the official bootnodes; and (4) start the node so it begins syncing. Once synced, the node is a full participant on testnet. (For reference, Cosmostation documented their experience running a Monad testnet validator, noting the chain’s performance and consensus stability.) Finally, note that because the testnet is EVM-compatible, one can also connect any standard Ethereum client (like geth) in “light” mode via RPC or use provider services from QuickNode or Alchemy, which already list Monad Testnet support ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Build%20without%20constraints)).  

### Deploying Smart Contracts  

Deploying contracts on Monad Testnet is nearly identical to Ethereum. You write a Solidity contract, compile it, and send it to the network. Because of full EVM compatibility, all Ethereum development tools work out of the box ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=,designed%20for%20Ethereum)). For example:  

- **Hardhat:** Add a network entry in `hardhat.config.js` (or `hardhat.config.ts`) like:  

  ```js
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      // (optionally add accounts/private keys)
    }
  }
  ```  

  Then run your deployment script with `npx hardhat run scripts/deploy.js --network monadTestnet`. Hardhat will compile and send the contract to Monad Testnet.  

- **Foundry:** Use Foundry’s configuration (in `foundry.toml`) to set the default network to `monadTestnet` and point the RPC to `https://testnet-rpc.monad.xyz`. Foundry (forge/vm) will compile Solidity and deploy using the same commands as on Ethereum. In fact, Monad provides a Foundry template repo to streamline this.  

- **Remix:** In the Remix IDE, select “Injected Web3” or “Web3 Provider” and ensure your connected wallet (e.g. MetaMask) is set to Monad Testnet (Chain ID 10143). The contract can then be deployed from the Remix UI just as on Ethereum.  

Because Monad is EVM-equivalent, deployed contracts behave exactly as they would on Ethereum.  One important note: gas fees on testnet use MON units (with 18 decimals, like ETH) and are typically **near zero**, so you can deploy freely.  Existing Ethereum contracts, scripts, and libraries generally require **no code changes** for Monad. This means protocols, dApps, and tools like OpenZeppelin libraries, as well as block explorers and indexers (e.g. Etherscan clones), work seamlessly. For example, Imperator notes that Ethereum tooling such as Foundry and wallets like MetaMask and Phantom “plug fluidly into Monad” ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=,designed%20for%20Ethereum)).  

### Testnet Tools (Wallets, Faucet, Explorer)  

Monad’s developer portal and community provide several utilities for the testnet:  

- **Wallets:** You can use any Ethereum-compatible wallet (MetaMask, Brave, Rabby, etc.) by adding the Monad Testnet network (RPC `https://testnet-rpc.monad.xyz`, Chain ID 10143, symbol “MON”).  Phantom wallet (originally a Solana wallet) also supports Ethereum-based chains like Monad. Once the network is added, the wallet will show your MON balance and let you send transactions.  

- **Faucet:** Since testnet MON has no real value, a faucet is provided for free tokens. Visit **faucet.monad.xyz** and complete the request (often via a signature or social login). At this writing, the faucet dispenses a small amount of MON (e.g. ~0.01 MON) per day per address ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Faucet)). The tokens appear in your wallet instantly. The thirdweb chain info confirms the faucet details: **“Get free MON fast and reliably. 0.01 MON/day.”** ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Faucet)). Use the faucet any time you need funds for gas or testing.  

- **Block Explorer:** The primary and recommended testnet explorer is **testnet.monadexplorer.com** (`https://testnet.monadexplorer.com/`). This explorer allows you to view transactions, addresses, blocks, and importantly, **verify smart contracts** directly through its interface.
  - **Verifying Contracts:**
    *   **Via Explorer UI:** To verify a deployed contract on `testnet.monadexplorer.com`:
        1.  Navigate to the contract's address page on the explorer.
        2.  Look for a "Contract" tab or a "Verify & Publish" button/link.
        3.  You will typically need to provide:
            *   The contract's source code (often as a single flattened file or multiple files).
            *   The exact compiler version used (e.g., `v0.8.20+commit.a1b79de6`).
            *   The optimization settings used during compilation (enabled/disabled, runs).
            *   Any constructor arguments, ABI-encoded (usually without the `0x` prefix in UI forms).
            *   The license type (e.g., MIT, Unlicensed).
        4.  Submit the information. The explorer will recompile your code and compare the resulting bytecode with the on-chain bytecode. If they match, the contract source code will be publicly visible and marked as verified.
    *   **Via Hardhat (Recommended for Automation):** You can use the `hardhat-verify` plugin (often requires `@nomicfoundation/hardhat-verify`) configured for Monad's Sourcify instance.
        1.  **Install:** `npm install --save-dev @nomicfoundation/hardhat-verify` (or yarn add).
        2.  **Configure `hardhat.config.js` (or `.ts`):**
            ```javascript
            require("@nomicfoundation/hardhat-verify"); // Add this line at the top

            const config = { // Your existing config
              solidity: "0.8.20", // Use your contract's compiler version
              networks: {
                monad: { // Or your network name for Monad Testnet
                  url: "https://testnet-rpc.monad.xyz",
                  // Add accounts if needed: accounts: [`0x${PRIVATE_KEY}`]
                },
              },
              etherscan: { // Required by hardhat-verify, but points to Sourcify
                apiKey: {
                  monad: "no-api-key-needed", // Placeholder
                },
                customChains: [
                  {
                    network: "monad",
                    chainId: 10143,
                    urls: {
                      apiURL: "https://sourcify-api-monad.blockvision.org/server", // Sourcify API for Monad
                      browserURL: "https://testnet.monadexplorer.com" // Explorer URL
                    }
                  }
                ]
              },
              sourcify: { // Optional: Explicit Sourcify config (may not be needed if etherscan customChains works)
                enabled: true
              }
            };

            module.exports = config;
            ```
        3.  **Run Verification:** After deploying your contract, run:
            ```bash
            npx hardhat verify --network monad YOUR_CONTRACT_ADDRESS constructorArg1 constructorArg2 ...
            ```
            Replace `YOUR_CONTRACT_ADDRESS` and provide constructor arguments if any.
        4.  **Troubleshooting:** If verification times out, especially with complex contracts, you might need to adjust compiler settings in `hardhat.config.js` to embed source code directly in metadata (less common now but sometimes helpful):
            ```javascript
            module.exports = {
              solidity: {
                version: "0.8.20", // Your version
                settings: {
                  metadata: {
                    bytecodeHash: "none", // disable linking via IPFS hash
                    // useLiteralContent: true // Embeds source directly (increases metadata size)
                  },
                  optimizer: { // Ensure optimizer settings match deployment
                    enabled: true,
                    runs: 200,
                  },
                  // ... other settings
                }
              },
              // ... rest of config
            };
            ```
            Recompile and redeploy if you change compiler settings. Verification can also be done programmatically within your deployment scripts using `hre.run("verify:verify", { ... })`.

  

In summary, to interact with Monad Testnet: configure your wallet for Chain ID 10143, request test MON from the faucet, and use the block explorer to verify transactions. All other standard Web3 tools (Alchemy, QuickNode, Dune, etc.) can be pointed at the testnet RPC or explorer in the same way they do for Ethereum networks. As one developer guide highlights: “Everything you need to deploy on Monad Testnet, from the faucet, network details and explorer, we got you” ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Everything%20you%20need%20to%20deploy,and%20explorer%2C%20we%20got%20you)).  

*Figure:* Guidelines for an MCP server (from the “MCP Madness” community mission poster). The server **must be open-source**, integrate smoothly with Claude Desktop or Cursor IDE, interact with the Monad Testnet, and handle long, multi-step tasks. Bonus points are given for **easy installation** and achieving more with fewer prompts.  

## MCP Development on Monad  

The **Model Context Protocol (MCP)** allows AI models (like Claude) to call external tools through well-defined interfaces. In the context of Monad, an **MCP server** is a program (often written in Node.js) that implements tool endpoints for blockchain-related queries. For example, Monad’s tutorial shows creating an MCP server that can **check a MON balance** on testnet ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=1)) ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=%2F%2F%20Create%20a%20new%20MCP,balance%22%5D)).  

### Setting Up an MCP Server  

To build an MCP tool, first install Node.js (v16 or later). Then, clone the example repo and install dependencies:  

1. Clone the tutorial repository:  
   ```bash
   git clone https://github.com/monad-developers/monad-mcp-tutorial.git
   cd monad-mcp-tutorial
   ```  
2. Install packages with NPM or Yarn:  
   ```bash
   npm install
   ```  
   (This includes the `@modelcontext/mcp-server` library.)  ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=1))  

Next, implement your tools in code. In the tutorial’s `src/index.ts`, a new MCP server instance is created as follows:  

```js
const server = new McpServer({
  name: "monad-testnet",
  version: "0.0.1",
  capabilities: ["get-mon-balance"]
});
```  

Here `name` and `version` identify your server, and `capabilities` lists the tool names it provides ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=%2F%2F%20Create%20a%20new%20MCP,balance%22%5D)). Then define each tool. For example, the “get-mon-balance” tool is added with:  

```js
server.tool(
  "get-mon-balance",
  "Get MON balance for an address on Monad testnet",
  { address: z.string().describe("Monad address to check") },
  async ({ address }) => {
    const balance = await publicClient.getBalance({ address });
    return {
      content: [{
        type: "text",
        text: `Balance for ${address}: ${formatUnits(balance, 18)} MON`
      }]
    };
  }
);
```  

In this scaffold, the input schema (using Zod) ensures `address` is a string, and the implementation fetches the balance via a public RPC client. (Error handling can be added too.) Once your server code is written, build it with:  
```bash
npm run build
```  
to produce `build/index.js` ([monad-mcp-tutorial/README.md at main · monad-developers/monad-mcp-tutorial · GitHub](https://github.com/monad-developers/monad-mcp-tutorial/blob/main/README.md#:~:text=Build%20the%20project)).  

Finally, run the server with Node:  
```bash
node build/index.js
```  
The server will listen on standard IO for MCP requests. At this point the MCP server is ready to be used as a tool. (In development you can leave it running in a terminal.)  

### Best Practices for MCP Tools  

When creating MCP tools for Monad, follow general best practices for reliability and usefulness:  

- **Clear functionality:** Each tool should have one specific purpose (e.g. “get-mon-balance”). Give it a descriptive name and description so the LLM knows when to use it.  
- **Input validation:** Use schemas (like Zod) to validate inputs. This prevents misuse and ensures type safety.  
- **Graceful error handling:** Catch any exceptions and return a friendly error message. For instance, in the balance tool example, any RPC error is caught and returned as:  
  > “Failed to retrieve balance for address: [address]. Error: [message]” ([monad-mcp-tutorial/README.md at main · monad-developers/monad-mcp-tutorial · GitHub](https://github.com/monad-developers/monad-mcp-tutorial/blob/main/README.md#:~:text=%2F%2F%20If%20the%20balance%20check,message)).  
  This way, the AI model receives a clear failure notice rather than a broken chain.  

- **Concise outputs:** Return human-readable text. In the example above, the balance is formatted with `formatUnits` for easy reading.  
- **Chain-of-action friendliness:** If the task requires multiple steps, consider breaking it into sub-tools or guiding the LLM with intermediate feedback. The server should be able to handle *long, helpful chains of actions* as per the mission goals.  

- **Open source and documentation:** Since the MCP server will be shared, maintain it as an open-source repo. Document the API in a README so users know how to install and run it.  

By following these practices, your MCP tools will be robust and assist the AI effectively.  

### Integration with Claude Desktop and Cursor IDE  

**Claude Desktop:** Once your MCP server is running locally, you integrate it with Claude by editing the Claude Desktop settings. Open **Claude > Settings > Developer**. There, find (or create) the `claude_desktop_config.json` file. Add an entry under `"mcpServers"`, for example:  

```json
{
  "mcpServers": {
    "monad-mcp": {
      "command": "node",
      "args": ["/<path-to-project>/build/index.js"]
    }
  }
}
``` 

([monad-mcp-tutorial/README.md at main · monad-developers/monad-mcp-tutorial · GitHub](https://github.com/monad-developers/monad-mcp-tutorial/blob/main/README.md#:~:text=4,server%20and%20save%20the%20file))  

Replace `"/<path-to-project>/build/index.js"` with the actual path to your server’s built script. This tells Claude to launch your Node server as a tool called "monad-mcp". Save the file and restart Claude Desktop. Now, in Claude conversations (in developer mode), you can call the `get-mon-balance` tool and Claude will execute it and return the output.  

**Cursor IDE:** Cursor is an AI-powered coding environment that can also call external tools. While specifics depend on Cursor’s current UI, the process is similar: you configure Cursor (likely in its settings or a config file) to point to your running MCP server script as an external tool. In general, treat it like adding an AI plugin: specify the command (`node`) and the script path. Consult Cursor’s documentation for adding custom tools. The goal is the same as with Claude: the AI assistant in the IDE should see your MCP tools as available functions. Ensuring seamless integration means your server should start with minimal prompts (e.g. “run get-mon-balance for address X”) and return accurate results.  

## Bonus Tips  

- **More with Fewer Prompts:** Encourage the AI to leverage your tool fully. For instance, if a task involves multiple blockchain queries (balances, tx lookups, contract calls), you might offer several dedicated tools rather than requiring separate prompts for each. Group related functionality and handle logic internally. For example, you could provide a tool that fetches *both* the balance and recent transactions for an address. This reduces the need for back-and-forth prompts. Additionally, provide thorough instructions or defaults in your tool code (such as default addresses or contract ABIs) so that the AI can achieve more outcomes with a single tool invocation.  

- **Testing and Iteration:** Before sharing, test your MCP server by prompting it in Claude or Cursor. Refine the schema and output until interactions are smooth. Sometimes tweaking the tool description helps the LLM choose it correctly. The goal is “**accurate and useful outputs**,” so iterate on the implementation until it consistently gives the right information.  

By following these guidelines and leveraging the references above, developers and AI-assisted devs can effectively build on Monad’s Testnet. The combination of Monad’s high-performance EVM chain and the new MCP tool standard opens the door for powerful developer workflows and AI integrations.  

**Sources:** Official Monad documentation and developer portal ([Monad | The Most Performant EVM-Compatible Layer 1 Blockchain](https://www.monad.xyz/#:~:text=Speed%20without%20sacrifice,Monad)) ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Build%20without%20constraints)) ([Monad Developer Portal](https://developers.monad.xyz/#:~:text=Everything%20you%20need%20to%20deploy,and%20explorer%2C%20we%20got%20you)); Imperator project overview ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=MonadDB%20is%20a%20custom%20database,optimized%20networks)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=,designed%20for%20Ethereum)) ([What is Monad (MONAD) - A Comprehensive Overview](https://www.imperator.co/resources/blog/what-is-monad-blockchain-presentation#:~:text=What%20is%20the%20average%20throughput,of%20Monad%20Network)); Monad testnet resources (thirdweb/ChainList) ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Faucet)) ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Chain%20ID)) ([Monad Testnet: RPC and Chain Settings](https://thirdweb.com/monad-testnet#:~:text=Block%20Explorer)); Monad MCP tutorial repository ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=1)) ([GitHub - monad-developers/monad-mcp-tutorial: Monad MCP Tutorial](https://github.com/monad-developers/monad-mcp-tutorial#:~:text=%2F%2F%20Create%20a%20new%20MCP,balance%22%5D)) ([monad-mcp-tutorial/README.md at main · monad-developers/monad-mcp-tutorial · GitHub](https://github.com/monad-developers/monad-mcp-tutorial/blob/main/README.md#:~:text=%2F%2F%20If%20the%20balance%20check,message)); Claude Desktop config guide ([monad-mcp-tutorial/README.md at main · monad-developers/monad-mcp-tutorial · GitHub](https://github.com/monad-developers/monad-mcp-tutorial/blob/main/README.md#:~:text=4,server%20and%20save%20the%20file)); Monad hardware recommendations ([Hardware Requirements | Monad Developer Documentation](https://docs.monad.xyz/monad-arch/hardware-requirements#:~:text=The%20following%20hardware%20requirements%20are,run%20a%20Monad%20full%20node)).
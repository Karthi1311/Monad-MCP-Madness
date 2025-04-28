import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { 
  createPublicClient, 
  http, 
  formatUnits, 
  defineChain, 
  createWalletClient, 
  parseEther,
  parseUnits,
  type Hex,
  type Abi,
  decodeAbiParameters,
  encodeAbiParameters
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import solc from 'solc';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// --- In-Memory Session Context --- 
// This is intended for local development convenience ONLY.
interface SessionContext {
  privateKey?: `0x${string}`;
  address?: `0x${string}`;
  account?: 'PrivateKeyAccount'; // Use PrivateKeyAccount type
}
const sessionContext: SessionContext = {};

// --- Blockchain Configuration ---

// Define Monad Testnet configuration based on monad.md
const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'MonadExplorer', url: 'https://testnet.monadexplorer.com/' },
  },
  testnet: true,
});

// Create a public client to interact with Monad Testnet
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// Helper function to get a wallet client from a private key
const getWallet = (privateKey: `0x${string}`) => {
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error('Invalid private key format. Please provide a 64-character hex string starting with 0x.');
  }
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(),
  });
};

// Helper function to get the wallet client from context or throw error
const getContextWallet = () => {
  if (!sessionContext.privateKey || !sessionContext.account) {
    throw new Error('User context (private key) not set. Use the \'set-user-context\' tool first.');
  }
  return createWalletClient({
    account: sessionContext.account,
    chain: monadTestnet,
    transport: http(),
  });
};

// Helper function to compile Solidity code - MODIFIED to return metadata
const compileContract = (contractName: string, sourceCode: string, optimizationRuns?: number) => {
  const input = {
    language: 'Solidity',
    sources: {
      [contractName + '.sol']: {
        content: sourceCode,
      },
    },
    settings: {
      optimizer: {
        enabled: optimizationRuns !== undefined && optimizationRuns > 0,
        runs: optimizationRuns || 200, // Default to 200 if enabled but not specified
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'metadata'], // Request metadata
        },
      },
    },
  };

  const outputString = solc.compile(JSON.stringify(input));
  const output = JSON.parse(outputString);

  if (output.errors) {
    const errors = output.errors.filter((err: any) => err.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Solidity compilation failed: ${errors.map((err: any) => err.formattedMessage).join('\n')}`);
    }
    const warnings = output.errors.filter((err: any) => err.severity === 'warning');
    if (warnings.length > 0) {
        console.warn(`Solidity compilation warnings:\n${warnings.map((err: any) => err.formattedMessage).join('\n')}`);
    }
  }

  const compiledContract = output.contracts[contractName + '.sol']?.[contractName];
  if (!compiledContract) {

    const contractKey = Object.keys(output.contracts[contractName + '.sol'] || {})[0];
    const foundContract = output.contracts[contractName + '.sol']?.[contractKey];
    if (!foundContract) {
        throw new Error(`Contract ${contractName} not found in compilation output.`);
    }

    return {
        abi: foundContract.abi,
        bytecode: `0x${foundContract.evm.bytecode.object}`,
        metadata: foundContract.metadata, // Return metadata
    };
  }

  return {
    abi: compiledContract.abi,
    bytecode: `0x${compiledContract.evm.bytecode.object}`,
    metadata: compiledContract.metadata, // Return metadata
  };
};


const server = new McpServer({
  name: "monad-testnet",
  version: "0.0.6", // Incremented version for new features
  capabilities: [
    "set-user-context",
    "get-user-context",
    "get-mon-balance",
    "deploy-contract",
    "create-erc20-token",
    // "verify-contract-guidance", // REMOVED
    "verify-contract", // Kept for automated verification
    "get-transaction-status",
    "get-block-info",
    "read-contract",
    "write-contract",
    "estimate-gas",
    "transfer-mon",
    "get-latest-block",
    "get-contract-abi",
    "get-token-balance",
    "get-token-info",
    "approve-erc20",
    "get-allowance",
    "get-gas-price"
  ]
});

// --- Context Management Tools ---

// Define the 'set-user-context' tool
server.tool(
  "set-user-context",
  "Sets the user's private key for the current session. WARNING: For local development only. Cleared on server restart.",
  {
    privateKey: z.string().startsWith('0x').length(66).describe("The user's private key (64 hex chars, 0x prefix). This will NOT be persisted.")
  },
  async ({ privateKey }) => {
    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      sessionContext.privateKey = privateKey as `0x${string}`;
      sessionContext.address = account.address;
      sessionContext.account = account;
      console.error(`User context set for address: ${account.address}`);
      return {
        content: [{ type: "text", text: `Session context updated. Active address: ${account.address}` }]
      };
    } catch (error: any) {
      console.error('Error setting user context:', error);
      sessionContext.privateKey = undefined;
      sessionContext.address = undefined;
      sessionContext.account = undefined;
      return {
        content: [{ type: "text", text: `Failed to set user context. Error: ${error.message}` }]
      };
    }
  }
);

// Define the 'get-user-context' tool
server.tool(
  "get-user-context",
  "Gets the currently active user address set in the session context.",
  {},
  async () => {
    if (sessionContext.address) {
      return {
        content: [{ type: "text", text: `Current active address in session: ${sessionContext.address}` }]
      };
    } else {
      return {
        content: [{ type: "text", text: "User context (address) is not set. Use 'set-user-context' first." }]
      };
    }
  }
);

// Define the 'get-mon-balance' tool (MODIFIED)
server.tool(
  "get-mon-balance",
  "Get MON balance for a specific address or the address set in the current session context on Monad testnet.",
  { address: z.string().optional().describe("Monad address (Ethereum-style, 0x...) to check. If omitted, uses the address from the session context.") },
  async ({ address }) => {
    let targetAddress = address;
    try {
      if (!targetAddress) {
        if (!sessionContext.address) {
          throw new Error('No address provided and user context is not set. Use \'set-user-context\' or provide an address.');
        }
        targetAddress = sessionContext.address;
        console.error(`Using address from session context: ${targetAddress}`);
      }

      // Ensure address is hex format
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        throw new Error('Invalid address format. Please provide a valid Ethereum-style address starting with 0x.');
      }
      // Cast address explicitly to `0x${string}` for viem
      const balance = await publicClient.getBalance({ address: targetAddress as `0x${string}` }); 
      return {
        content: [{ 
          type: "text", 
          text: `Balance for ${targetAddress}: ${formatUnits(balance, 18)} MON` 
        }]
      };
    } catch (error: any) {
      console.error(`Error fetching balance for ${targetAddress || 'context address'}:`, error);
      // Return a user-friendly error message
      return {
        content: [{ 
          type: "text", 
          text: `Failed to retrieve balance for address: ${targetAddress || '(context not set)'}. Error: ${error.message}` 
        }]
      };
    }
  }
);

// 'deploy-contract' tool
server.tool(
  "deploy-contract",
  "Compiles and deploys a Solidity smart contract to Monad testnet using the provided private key or the session context. Returns deployment details including info needed for verification.",
  {
    contractName: z.string().describe("The name of the main contract (without .sol extension)."),
    sourceCode: z.string().describe("The full Solidity source code as a string."),
    constructorArgs: z.array(z.any()).optional().describe("An array of arguments for the contract constructor (if any)."),
    privateKey: z.string().optional().describe("Deployer's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!"),
    optimizationRuns: z.number().int().positive().optional().describe("Number of optimization runs (e.g., 200). Leave undefined or 0 for no optimization.")
  },
  async ({ contractName, sourceCode, constructorArgs, privateKey, optimizationRuns }) => {
    try {
      const walletClient = privateKey ? getWallet(privateKey as `0x${string}`) : getContextWallet();
      const deployerAddress = walletClient.account.address;
      const isOptimized = optimizationRuns !== undefined && optimizationRuns > 0;
      const runs = isOptimized ? optimizationRuns : 0; // Use 0 if not optimized

      console.error(`Attempting to compile ${contractName}.sol... Optimization: ${isOptimized ? `Enabled (${runs} runs)` : 'Disabled'}`);

      // Pass optimizationRuns to compileContract
      const { abi, bytecode, metadata } = compileContract(contractName, sourceCode, runs); // Capture metadata
      console.error(`Compilation successful. ABI items: ${abi.length}, Bytecode size: ${bytecode.length}`);

      // Extract compiler version from metadata
      let compilerVersion = 'unknown';
      if (metadata) {
          try {
              const metadataJson = JSON.parse(metadata);
              compilerVersion = metadataJson.compiler.version;
              console.error(`Detected compiler version: ${compilerVersion}`);
          } catch (e) {
              console.warn("Could not parse metadata to extract compiler version.");
          }
      }

      console.error(`Deploying from address: ${deployerAddress}`);

      console.error('Sending deployment transaction...');
      const hash = await walletClient.deployContract({
        abi,
        bytecode: bytecode as `0x${string}`,
        args: constructorArgs,
        account: walletClient.account,
      });
      console.error(`Deployment transaction sent. Hash: ${hash}`);

      console.error('Waiting for transaction receipt...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.error(`Transaction confirmed. Status: ${receipt.status}`);

      if (receipt.status === 'reverted') {
        throw new Error(`Contract deployment failed (reverted). Gas used: ${receipt.gasUsed}`);
      }
      if (!receipt.contractAddress) {
        throw new Error('Contract deployment succeeded but no contract address found in receipt.');
      }
      const contractAddress = receipt.contractAddress;
      console.error(`Contract deployed successfully at address: ${contractAddress}`);

      // Include details needed for verification in the success message
      let successMessage = `Contract '${contractName}' deployed successfully!\n`;
      successMessage += `Address: ${contractAddress}\n`;
      successMessage += `Transaction Hash: ${hash}\n`;
      successMessage += `Explorer: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}\n\n`;
      successMessage += `--- For Automated Verification ('verify-contract' tool) ---\n`;
      successMessage += `Contract Name: ${contractName}\n`;
      successMessage += `Contract Address: ${contractAddress}\n`;
      successMessage += `Compiler Version: ${compilerVersion} (Full version string might be needed)\n`;
      successMessage += `Optimization Enabled: ${isOptimized}\n`;
      if (isOptimized) {
        successMessage += `Optimization Runs: ${runs}\n`;
      }


      return {
        content: [{
          type: "text",
          text: successMessage
        }]
      };
    } catch (error: any) {
      console.error(`Error deploying contract ${contractName}:`, error);
      return {
        content: [{
          type: "text",
          text: `Failed to deploy contract '${contractName}'. Error: ${error.message}`
        }]
      };
    }
  }
);

// Define the 'create-erc20-token' tool (MODIFIED - includes verification info)
server.tool(
  "create-erc20-token",
  "Deploys a standard ERC20 token contract to Monad testnet using the session context or a provided private key. Returns deployment details including info needed for verification.",
  {
    tokenName: z.string().describe("The name for the token (e.g., 'My Token')."),
    tokenSymbol: z.string().describe("The symbol for the token (e.g., 'MTK')."),
    initialSupply: z.number().positive().describe("Initial total supply in whole tokens (e.g., 1000). Minted to deployer."),
    privateKey: z.string().optional().describe("Deployer's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
  },
  async ({ tokenName, tokenSymbol, initialSupply, privateKey }) => {
    try {
      const walletClient = privateKey ? getWallet(privateKey as `0x${string}`) : getContextWallet();
      const deployerAddress = walletClient.account.address;

      // Basic ERC20 template using OpenZeppelin (ensure OpenZeppelin contracts are installed: npm install @openzeppelin/contracts)
      const contractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Use a specific version

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ${tokenSymbol}Token is ERC20 {
    constructor(uint256 _initialSupply) ERC20("${tokenName}", "${tokenSymbol}") {
        // Mint initial supply to the deployer
        // Assumes 18 decimals by default from OpenZeppelin ERC20
        _mint(msg.sender, _initialSupply * (10**decimals()));
    }
}
      `.trim();

      const contractName = `${tokenSymbol}Token`;
      const optimizationRuns = 200; // Standard optimization for OZ contracts
      const isOptimized = true;

      console.error(`Attempting to compile ${contractName}.sol... Optimization: Enabled (${optimizationRuns} runs)`);
      const { abi, bytecode, metadata } = compileContract(contractName, contractSource, optimizationRuns);
      console.error(`Compilation successful. ABI items: ${abi.length}, Bytecode size: ${bytecode.length}`);

       // Extract compiler version from metadata
      let compilerVersion = 'unknown';
      if (metadata) {
          try {
              const metadataJson = JSON.parse(metadata);
              compilerVersion = metadataJson.compiler.version;
              console.error(`Detected compiler version: ${compilerVersion}`);
          } catch (e) {
              console.warn("Could not parse metadata to extract compiler version.");
          }
      }


      console.error(`Deploying from address: ${deployerAddress}`);


      const initialSupplyWei = parseEther(initialSupply.toString());
      console.error(`Initial supply in wei: ${initialSupplyWei}`);

      console.error('Sending deployment transaction...');
      const hash = await walletClient.deployContract({
        abi,
        bytecode: bytecode as `0x${string}`,
        args: [initialSupplyWei], // Pass initial supply to constructor
        account: walletClient.account,
      });
      console.error(`Deployment transaction sent. Hash: ${hash}`);

      console.error('Waiting for transaction receipt...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.error(`Transaction confirmed. Status: ${receipt.status}`);

      if (receipt.status === 'reverted') {
        throw new Error(`Token deployment failed (reverted). Gas used: ${receipt.gasUsed}`);
      }
      if (!receipt.contractAddress) {
        throw new Error('Token deployment succeeded but no contract address found in receipt.');
      }
      const tokenAddress = receipt.contractAddress;
      console.error(`Token '${tokenName}' (${tokenSymbol}) deployed successfully at address: ${tokenAddress}`);

      let successMessage = `ERC20 Token '${tokenName}' (${tokenSymbol}) deployed successfully!\n`;
      successMessage += `Address: ${tokenAddress}\n`;
      successMessage += `Initial Supply: ${initialSupply} ${tokenSymbol} (minted to deployer: ${deployerAddress})\n`;
      successMessage += `Transaction Hash: ${hash}\n`;
      successMessage += `Explorer: ${monadTestnet.blockExplorers.default.url}/token/${tokenAddress}\n\n`; // Correct explorer URL for tokens
      successMessage += `--- For Automated Verification ('verify-contract' tool) ---\n`;
      successMessage += `Contract Name: ${contractName}\n`;
      successMessage += `Contract Address: ${tokenAddress}\n`;
      successMessage += `Compiler Version: ${compilerVersion} (Full version string might be needed)\n`;
      successMessage += `Optimization Enabled: ${isOptimized}\n`;
      successMessage += `Optimization Runs: ${optimizationRuns}\n`;
      successMessage += `Constructor Arguments (ABI Encoded): Not typically needed for Sourcify with metadata, but can be generated if required.\n`;
      successMessage += `Source Code: (Provide the source code below to the 'verify-contract' tool)\n\`\`\`solidity\n${contractSource}\n\`\`\``;


      return {
        content: [{ type: "text", text: successMessage }]
      };
    } catch (error: any) {
      console.error(`Error creating ERC20 token ${tokenName}:`, error);
      // Improved error reporting
      let errorMessage = `Failed to create ERC20 token '${tokenName}'. Error: ${error.message}`;
      if (error.message.includes("Cannot find module '@openzeppelin/contracts")) {
          errorMessage += "\n\nPlease ensure OpenZeppelin contracts are installed: `npm install @openzeppelin/contracts` or `yarn add @openzeppelin/contracts`";
      }
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);


// 'verify-contract' tool (using Sourcify)
server.tool(
  "verify-contract",
  "Attempts to automatically verify a deployed contract on the Monad testnet explorer via Sourcify API.",
  {
    contractAddress: z.string().startsWith('0x').length(42).describe("The address of the deployed contract."),
    contractName: z.string().describe("The name of the main contract (without .sol extension)."),
    sourceCode: z.string().describe("The full Solidity source code used for deployment."),
    optimizationRuns: z.number().int().positive().optional().describe("Number of optimization runs used during deployment (e.g., 200). Leave undefined if optimization was disabled.")
    // constructorArgs: z.array(z.any()).optional().describe("Array of constructor arguments (if any). ABI encoding is handled by some verification services but might need manual input.")
  },
  async ({ contractAddress, contractName, sourceCode, optimizationRuns /*, constructorArgs */ }) => {
    const sourcifyApiUrl = 'https://sourcify-api-monad.blockvision.org';
    const chainId = monadTestnet.id; // 10143

    try {
      console.error(`Attempting automated verification for ${contractName} at ${contractAddress} on chain ${chainId}`);

      // 1. Check if already verified
      try {
        const checkResponse = await axios.get(`${sourcifyApiUrl}/checkByAddresses`, {
          params: { addresses: contractAddress, chainIds: chainId }
        });
        if (checkResponse.data && checkResponse.data[0]?.status === 'perfect') {
          console.error(`Contract ${contractAddress} is already verified (perfect match).`);
          return { content: [{ type: "text", text: `Contract ${contractAddress} is already verified on Sourcify.` }] };
        } else if (checkResponse.data && checkResponse.data[0]?.status === 'partial') {
           console.error(`Contract ${contractAddress} has a partial match on Sourcify.`);
        }
      } catch (checkError: any) {
        // Log check error but proceed with verification attempt
        console.warn(`Sourcify check failed (proceeding with verification attempt): ${checkError.message}`);
      }

      // 2. Compile the contract locally to get metadata
      console.error(`Compiling ${contractName}.sol for verification metadata... Optimization: ${optimizationRuns ?? 'Disabled'}`);
      const { metadata } = compileContract(contractName, sourceCode, optimizationRuns);
      if (!metadata) {
        throw new Error('Failed to retrieve contract metadata during compilation.');
      }
      console.error('Compilation successful, metadata obtained.');

      // 3. Prepare the payload for the Sourcify API
      const payload = {
        address: contractAddress,
        chain: chainId.toString(),
        files: {
          'metadata.json': metadata,
          [`${contractName}.sol`]: sourceCode
        }
      };

      // 4. Send POST request to Sourcify
      console.error(`Submitting verification request to Sourcify API: ${sourcifyApiUrl}`);
      const submitResponse = await axios.post(sourcifyApiUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.error('Sourcify submission response:', submitResponse.data);

      // 5. Handle response
      if (submitResponse.data?.result?.[0]?.status === 'perfect') {
         return {
           content: [{ type: "text", text: `Contract ${contractName} (${contractAddress}) successfully verified (perfect match)! Explorer: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
         };
      } else if (submitResponse.data?.result?.[0]?.status === 'partial') {
         return {
           content: [{ type: "text", text: `Contract ${contractName} (${contractAddress}) has a partial match on Sourcify. Metadata might be missing or slightly different. Explorer: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
         };
      } else if (submitResponse.data?.error) {
        throw new Error(`Sourcify verification failed: ${submitResponse.data.error}`);
      } else {
        return {
          content: [{ type: "text", text: `Verification request submitted for ${contractName} (${contractAddress}). Status: ${submitResponse.data?.result?.[0]?.status || 'Unknown'}. Check the explorer shortly: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
        };
      }

    } catch (error: any) {
      console.error(`Error during automated verification for ${contractAddress}:`, error);
      let errorMessage = `Automated verification attempt failed for ${contractName} (${contractAddress}).`;
      if (error.response?.data?.error) {
        errorMessage += ` Sourcify API Error: ${error.response.data.error}`;
      } else if (error.message.includes('compilation failed')) {
        errorMessage += ` Local compilation failed: ${error.message}`;
      } else {
        errorMessage += ` Error: ${error.message}`;
      }
      errorMessage += '\n\nPlease ensure the contract name, source code, and optimization settings exactly match the deployed contract.';
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);

// Define the 'get-transaction-status' tool
server.tool(
  "get-transaction-status",
  "Checks the status and details of a transaction on Monad testnet using its hash.",
  { hash: z.string().startsWith('0x').length(66).describe("The transaction hash (0x...).") },
  async ({ hash }) => {
    try {
      console.error(`Checking status for transaction: ${hash}`);
      const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` }); // Fix type cast
      console.error(`Receipt found for ${hash}: Status ${receipt.status}`);
      
      let details = `Transaction: ${hash}\n`;
      details += `Status: ${receipt.status}\n`;
      details += `Block Number: ${receipt.blockNumber}\n`;
      details += `Block Hash: ${receipt.blockHash}\n`;
      details += `From: ${receipt.from}\n`;
      details += `To: ${receipt.to || 'Contract Creation'}\n`;
      if (receipt.contractAddress) {
        details += `Contract Created: ${receipt.contractAddress}\n`;
      }
      details += `Gas Used: ${receipt.gasUsed}\n`;
      details += `Effective Gas Price: ${formatUnits(receipt.effectiveGasPrice, 9)} Gwei\n`; // Gas price usually in Gwei
      details += `Logs: ${receipt.logs.length} events\n`;
      details += `Explorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}`;

      return {
        content: [{ type: "text", text: details }]
      };
    } catch (error: any) {
      console.error(`Error fetching transaction receipt for ${hash}:`, error);
      // Handle cases where the transaction is not found or still pending
      let errorMessage = `Failed to get receipt for transaction ${hash}.`;
      if (error.message.includes('not found')) {
        errorMessage += ' It might still be pending or the hash is incorrect.';
      } else {
        errorMessage += ` Error: ${error.message}`;
      }
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);

// Define the 'get-block-info' tool
server.tool(
  "get-block-info",
  "Retrieves information about a specific block on Monad testnet.",
  {
    blockIdentifier: z.union([
      z.bigint().describe("The block number."),
      z.enum(['latest', 'safe', 'finalized', 'earliest']).describe("A block tag ('latest', 'safe', 'finalized', 'earliest').")
    ]).describe("Block number (as a BigInt) or a block tag string.")
  },
  async ({ blockIdentifier }) => {
    try {
      const param = typeof blockIdentifier === 'bigint' 
        ? { blockNumber: blockIdentifier } 
        : { blockTag: blockIdentifier };
      console.error(`Fetching block info for: ${blockIdentifier}`);
      const block = await publicClient.getBlock(param);
      console.error(`Block ${block.number} found.`);

      let details = `Block Number: ${block.number}\n`;
      details += `Hash: ${block.hash}\n`;
      details += `Parent Hash: ${block.parentHash}\n`;
      details += `Timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()} (${block.timestamp})\n`;
      details += `Transactions: ${block.transactions.length}\n`;
      details += `Miner: ${block.miner}\n`;
      details += `Gas Used: ${block.gasUsed}\n`;
      details += `Gas Limit: ${block.gasLimit}\n`;
      details += `Base Fee Per Gas: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + ' Gwei' : 'N/A (Pre-EIP1559)'}\n`;
      details += `Size: ${block.size} bytes\n`;
      details += `Explorer: ${monadTestnet.blockExplorers.default.url}/block/${block.number}`;

      return {
        content: [{ type: "text", text: details }]
      };
    } catch (error: any) {
      console.error(`Error fetching block info for ${blockIdentifier}:`, error);
      return {
        content: [{ type: "text", text: `Failed to retrieve block info for ${blockIdentifier}. Error: ${error.message}` }]
      };
    }
  }
);

// Define the 'read-contract' tool
server.tool(
  "read-contract",
  "Reads data from a deployed smart contract using a view or pure function.",
  {
    contractAddress: z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: z.any().describe("The contract ABI (Application Binary Interface) as a JSON object or array."),
    functionName: z.string().describe("The name of the contract function to call."),
    args: z.array(z.any()).optional().describe("An array of arguments for the function call (if any).")
  },
  async ({ contractAddress, abi, functionName, args }) => {
    try {
      console.error(`Reading function '${functionName}' from contract ${contractAddress}`);
      const result = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: abi, // Remove 'as Abi'
        functionName,
        args: args || [],
      });
      console.error(`Read successful. Result: ${result}`);

      // Attempt to format the result nicely
      let formattedResult;
      if (typeof result === 'bigint') {
        formattedResult = result.toString();
      } else if (Array.isArray(result)) {
        formattedResult = JSON.stringify(result.map(item => typeof item === 'bigint' ? item.toString() : item));
      } else if (typeof result === 'object' && result !== null) {
         // Handle struct-like objects (may contain bigints)
         formattedResult = JSON.stringify(result, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
        );
      } else {
        formattedResult = String(result);
      }

      return {
        content: [{ type: "text", text: `Result from calling '${functionName}':\n${formattedResult}` }]
      };
    } catch (error: any) {
      console.error(`Error reading contract ${contractAddress} function ${functionName}:`, error);
      // Provide more specific ABI/function errors if possible
      let errorMessage = `Failed to read from contract ${contractAddress}.`;
      if (error.message.includes('Invalid ABI') || error.message.includes('Function not found')) {
        errorMessage += ' Check if the ABI is correct and the function exists.';
      } else if (error.message.includes('incorrect number of arguments')) {
         errorMessage += ' Check the provided arguments.';
      } else {
        errorMessage += ` Error: ${error.message}`;
      }
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);

// Define the 'write-contract' tool
server.tool(
  "write-contract",
  "Sends a transaction to a smart contract to execute a state-changing function.",
  {
    contractAddress: z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: z.any().describe("The contract ABI (Application Binary Interface) as a JSON object or array."),
    functionName: z.string().describe("The name of the contract function to call."),
    args: z.array(z.any()).optional().describe("An array of arguments for the function call (if any)."),
    privateKey: z.string().describe("The private key (0x...) of the account sending the transaction. WARNING: Handle with care!"),
    value: z.string().optional().describe("Amount of MON to send with the transaction (e.g., '0.1'). Optional.")
  },
  async ({ contractAddress, abi, functionName, args, privateKey, value }) => {
    try {
      // Use context wallet if private key is not provided
      const walletClient = privateKey ? getWallet(privateKey as `0x${string}`) : getContextWallet();
      const senderAddress = walletClient.account.address;
      console.error(`Preparing to call function '${functionName}' on contract ${contractAddress} from ${senderAddress}`);

      const txValue = value ? parseEther(value) : undefined;

      console.error('Sending transaction...');
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: abi, // Remove 'as Abi'
        functionName,
        args: args || [],
        account: walletClient.account,
        value: txValue,
        chain: monadTestnet // Explicitly set chain
      });
      console.error(`Transaction sent. Hash: ${hash}`);
      return {
        content: [{
          type: "text",
          text: `Transaction sent successfully!\nFunction: ${functionName}\nFrom: ${senderAddress}\nTo: ${contractAddress}\nHash: ${hash}\nExplorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}\n\nUse the 'get-transaction-status' tool with the hash to check its confirmation.`
        }]
      };
    } catch (error: any) {
      console.error(`Error writing to contract ${contractAddress} function ${functionName}:`, error);
      return {
        content: [{ type: "text", text: `Failed to send transaction. Error: ${error.message}` }]
      };
    }
  }
);

// Define the 'transfer-mon' tool
server.tool(
  "transfer-mon",
  "Transfers native MON tokens from the sender (private key or context) to a recipient address.",
  {
    recipientAddress: z.string().startsWith('0x').length(42).describe("The recipient's Monad address (0x...)." ),
    amount: z.string().describe("The amount of MON to send (e.g., '0.5', '10')."),
    privateKey: z.string().optional().describe("Sender's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
  },
  async ({ recipientAddress, amount, privateKey }) => {
    try {
      const walletClient = privateKey ? getWallet(privateKey as `0x${string}`) : getContextWallet();
      const senderAddress = walletClient.account.address;
      console.error(`Preparing to transfer ${amount} MON from ${senderAddress} to ${recipientAddress}`);

      const valueWei = parseEther(amount);

      console.error('Sending MON transfer transaction...');
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: recipientAddress as `0x${string}`,
        value: valueWei,
        chain: monadTestnet
      });
      console.error(`Transaction sent. Hash: ${hash}`);

      return {
        content: [{
          type: "text",
          text: `Successfully sent ${amount} MON from ${senderAddress} to ${recipientAddress}.\nTransaction Hash: ${hash}\nExplorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}\n\nUse 'get-transaction-status' to check confirmation.`
        }]
      };
    } catch (error: any) {
      console.error(`Error transferring MON to ${recipientAddress}:`, error);
      return {
        content: [{ type: "text", text: `Failed to transfer MON. Error: ${error.message}` }]
      };
    }
  }
);

// Define the 'transfer-erc20' tool
const erc20TransferAbi = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
] as const;

server.tool(
  "transfer-erc20",
  "Transfers ERC20 tokens from the sender (private key or context) to a recipient address.",
  {
    tokenContractAddress: z.string().startsWith('0x').length(42).describe("The address of the ERC20 token contract."),
    recipientAddress: z.string().startsWith('0x').length(42).describe("The recipient's address (0x...)." ),
    amount: z.string().describe("The amount of tokens to send (in standard units, e.g., '100'). Decimals are handled automatically."),
    privateKey: z.string().optional().describe("Sender's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
  },
  async ({ tokenContractAddress, recipientAddress, amount, privateKey }) => {
    try {
      const walletClient = privateKey ? getWallet(privateKey as `0x${string}`) : getContextWallet();
      const senderAddress = walletClient.account.address;
      console.error(`Preparing to transfer ${amount} tokens from ${tokenContractAddress} to ${recipientAddress} from sender ${senderAddress}`);

      // Get token decimals to parse amount correctly
      const decimals = await publicClient.readContract({
        address: tokenContractAddress as `0x${string}`,
        abi: erc20TransferAbi,
        functionName: 'decimals',
      });
      console.error(`Token decimals: ${decimals}`);
      const amountWei = parseUnits(amount, decimals);

      console.error('Sending ERC20 transfer transaction...');
      const hash = await walletClient.writeContract({
        address: tokenContractAddress as `0x${string}`,
        abi: erc20TransferAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountWei],
        account: walletClient.account,
        chain: monadTestnet // Explicitly set chain
      });
      console.error(`Transaction sent. Hash: ${hash}`);

      return {
        content: [{
          type: "text",
          text: `Successfully sent transaction to transfer ${amount} tokens (${tokenContractAddress}) from ${senderAddress} to ${recipientAddress}.\nTransaction Hash: ${hash}\nExplorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}\n\nUse 'get-transaction-status' to check confirmation.`
        }]
      };
    } catch (error: any) {
      console.error(`Error transferring ERC20 token ${tokenContractAddress} to ${recipientAddress}:`, error);
      return {
        content: [{ type: "text", text: `Failed to send ERC20 transfer transaction. Error: ${error.message}` }]
      };
    }
  }
);

// Define the 'estimate-gas' tool
server.tool(
  "estimate-gas",
  "Estimates the gas cost for a contract function call.",
  {
    contractAddress: z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: z.any().describe("The contract ABI as a JSON object or array."),
    functionName: z.string().describe("The name of the contract function."),
    args: z.array(z.any()).optional().describe("An array of arguments for the function call."),
    accountAddress: z.string().startsWith('0x').length(42).describe("The address of the account that would send the transaction."),
    value: z.string().optional().describe("Amount of MON to send (e.g., '0.1'). Optional.")
  },
  async ({ contractAddress, abi, functionName, args, accountAddress, value }) => {
    try {
      console.error(`Estimating gas for ${functionName} on ${contractAddress} from ${accountAddress}`);
      const txValue = value ? parseEther(value) : undefined;

      const estimatedGas = await publicClient.estimateContractGas({
        address: contractAddress as `0x${string}`,
        abi: abi, // Remove 'as Abi'
        functionName,
        args: args || [],
        account: accountAddress as `0x${string}`,
        value: txValue
      });
      console.error(`Estimated gas: ${estimatedGas}`);

      // Also fetch current gas price for a cost estimate
      const gasPrice = await publicClient.getGasPrice();
      const estimatedCost = estimatedGas * gasPrice;

      return {
        content: [{
          type: "text",
          text: `Estimated gas for calling '${functionName}': ${estimatedGas}\nCurrent Gas Price: ${formatUnits(gasPrice, 9)} Gwei\nEstimated Cost: ~${formatUnits(estimatedCost, 18)} MON`
        }]
      };
    } catch (error: any) {
      console.error(`Error estimating gas for ${contractAddress} function ${functionName}:`, error);
      // Provide more specific errors if possible
      let errorMessage = `Failed to estimate gas for ${functionName}.`;
       if (error.message.includes('execution reverted')) {
         errorMessage += ' The transaction would likely fail. Check arguments, contract state, or sender balance.';
       } else {
         errorMessage += ` Error: ${error.message}`;
       }
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);


// Start the server
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use console.error for status messages to avoid interfering with stdio JSON-RPC
  console.error('Monad MCP Server started and listening on stdio...');
}

startServer().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
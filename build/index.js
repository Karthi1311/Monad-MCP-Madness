"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const solc_1 = __importDefault(require("solc"));
const axios_1 = __importDefault(require("axios"));
const sessionContext = {};

const monadTestnet = (0, viem_1.defineChain)({
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
const publicClient = (0, viem_1.createPublicClient)({
    chain: monadTestnet,
    transport: (0, viem_1.http)(),
});

const getWallet = (privateKey) => {
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format. Please provide a 64-character hex string starting with 0x.');
    }
    const account = (0, accounts_1.privateKeyToAccount)(privateKey);
    return (0, viem_1.createWalletClient)({
        account,
        chain: monadTestnet,
        transport: (0, viem_1.http)(),
    });
};

const getContextWallet = () => {
    if (!sessionContext.privateKey || !sessionContext.account) {
        throw new Error('User context (private key) not set. Use the \'set-user-context\' tool first.');
    }
    return (0, viem_1.createWalletClient)({
        account: sessionContext.account,
        chain: monadTestnet,
        transport: (0, viem_1.http)(),
    });
};

const compileContract = (contractName, sourceCode, optimizationRuns) => {
    var _a, _b;
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
    const outputString = solc_1.default.compile(JSON.stringify(input));
    const output = JSON.parse(outputString);
    if (output.errors) {
        const errors = output.errors.filter((err) => err.severity === 'error');
        if (errors.length > 0) {
            throw new Error(`Solidity compilation failed: ${errors.map((err) => err.formattedMessage).join('\n')}`);
        }
        const warnings = output.errors.filter((err) => err.severity === 'warning');
        if (warnings.length > 0) {
            console.warn(`Solidity compilation warnings:\n${warnings.map((err) => err.formattedMessage).join('\n')}`);
        }
    }
    const compiledContract = (_a = output.contracts[contractName + '.sol']) === null || _a === void 0 ? void 0 : _a[contractName];
    if (!compiledContract) {
        // Try finding the contract if the filename doesn't exactly match the contract name key
        const contractKey = Object.keys(output.contracts[contractName + '.sol'] || {})[0];
        const foundContract = (_b = output.contracts[contractName + '.sol']) === null || _b === void 0 ? void 0 : _b[contractKey];
        if (!foundContract) {
            throw new Error(`Contract ${contractName} not found in compilation output.`);
        }
        // If found under a different key, use that
        return {
            abi: foundContract.abi,
            bytecode: `0x${foundContract.evm.bytecode.object}`,
            metadata: foundContract.metadata,
        };
    }
    return {
        abi: compiledContract.abi,
        bytecode: `0x${compiledContract.evm.bytecode.object}`,
        metadata: compiledContract.metadata, 
    };
};

const server = new mcp_js_1.McpServer({
    name: "monad-testnet",
    version: "0.0.6",
    capabilities: [
        "set-user-context",
        "get-user-context",
        "get-mon-balance",
        "deploy-contract",
        "create-erc20-token",
        "verify-contract",
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
server.tool("set-user-context", "Sets the user's private key for the current session. WARNING: For local development only. Cleared on server restart.", {
    privateKey: zod_1.z.string().startsWith('0x').length(66).describe("The user's private key (64 hex chars, 0x prefix). This will NOT be persisted.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ privateKey }) {
    try {
        const account = (0, accounts_1.privateKeyToAccount)(privateKey);
        sessionContext.privateKey = privateKey;
        sessionContext.address = account.address;
        sessionContext.account = account;
        console.error(`User context set for address: ${account.address}`);
        return {
            content: [{ type: "text", text: `Session context updated. Active address: ${account.address}` }]
        };
    }
    catch (error) {
        console.error('Error setting user context:', error);
        sessionContext.privateKey = undefined;
        sessionContext.address = undefined;
        sessionContext.account = undefined;
        return {
            content: [{ type: "text", text: `Failed to set user context. Error: ${error.message}` }]
        };
    }
}));
// Define the 'get-user-context' tool
server.tool("get-user-context", "Gets the currently active user address set in the session context.", {}, () => __awaiter(void 0, void 0, void 0, function* () {
    if (sessionContext.address) {
        return {
            content: [{ type: "text", text: `Current active address in session: ${sessionContext.address}` }]
        };
    }
    else {
        return {
            content: [{ type: "text", text: "User context (address) is not set. Use 'set-user-context' first." }]
        };
    }
}));
// --- Existing Tools (Modified for Context) ---
// Define the 'get-mon-balance' tool (MODIFIED)
server.tool("get-mon-balance", "Get MON balance for a specific address or the address set in the current session context on Monad testnet.", { address: zod_1.z.string().optional().describe("Monad address (Ethereum-style, 0x...) to check. If omitted, uses the address from the session context.") }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ address }) {
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
        const balance = yield publicClient.getBalance({ address: targetAddress });
        return {
            content: [{
                    type: "text",
                    text: `Balance for ${targetAddress}: ${(0, viem_1.formatUnits)(balance, 18)} MON`
                }]
        };
    }
    catch (error) {
        console.error(`Error fetching balance for ${targetAddress || 'context address'}:`, error);
        // Return a user-friendly error message
        return {
            content: [{
                    type: "text",
                    text: `Failed to retrieve balance for address: ${targetAddress || '(context not set)'}. Error: ${error.message}`
                }]
        };
    }
}));
// Define the 'deploy-contract' tool (MODIFIED)
server.tool("deploy-contract", "Compiles and deploys a Solidity smart contract to Monad testnet using the provided private key or the session context. Returns deployment details including info needed for verification.", {
    contractName: zod_1.z.string().describe("The name of the main contract (without .sol extension)."),
    sourceCode: zod_1.z.string().describe("The full Solidity source code as a string."),
    constructorArgs: zod_1.z.array(zod_1.z.any()).optional().describe("An array of arguments for the contract constructor (if any)."),
    privateKey: zod_1.z.string().optional().describe("Deployer's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!"),
    optimizationRuns: zod_1.z.number().int().positive().optional().describe("Number of optimization runs (e.g., 200). Leave undefined or 0 for no optimization.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ contractName, sourceCode, constructorArgs, privateKey, optimizationRuns }) {
    try {
        const walletClient = privateKey ? getWallet(privateKey) : getContextWallet();
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
            }
            catch (e) {
                console.warn("Could not parse metadata to extract compiler version.");
            }
        }
        console.error(`Deploying from address: ${deployerAddress}`);
        console.error('Sending deployment transaction...');
        const hash = yield walletClient.deployContract({
            abi,
            bytecode: bytecode,
            args: constructorArgs,
            account: walletClient.account,
        });
        console.error(`Deployment transaction sent. Hash: ${hash}`);
        console.error('Waiting for transaction receipt...');
        const receipt = yield publicClient.waitForTransactionReceipt({ hash });
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
    }
    catch (error) {
        console.error(`Error deploying contract ${contractName}:`, error);
        return {
            content: [{
                    type: "text",
                    text: `Failed to deploy contract '${contractName}'. Error: ${error.message}`
                }]
        };
    }
}));
// Define the 'create-erc20-token' tool (MODIFIED - includes verification info)
server.tool("create-erc20-token", "Deploys a standard ERC20 token contract to Monad testnet using the session context or a provided private key. Returns deployment details including info needed for verification.", {
    tokenName: zod_1.z.string().describe("The name for the token (e.g., 'My Token')."),
    tokenSymbol: zod_1.z.string().describe("The symbol for the token (e.g., 'MTK')."),
    initialSupply: zod_1.z.number().positive().describe("Initial total supply in whole tokens (e.g., 1000). Minted to deployer."),
    privateKey: zod_1.z.string().optional().describe("Deployer's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ tokenName, tokenSymbol, initialSupply, privateKey }) {
    try {
        const walletClient = privateKey ? getWallet(privateKey) : getContextWallet();
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
            }
            catch (e) {
                console.warn("Could not parse metadata to extract compiler version.");
            }
        }
        console.error(`Deploying from address: ${deployerAddress}`);
        // Convert initial supply to wei (assuming 18 decimals)
        const initialSupplyWei = (0, viem_1.parseEther)(initialSupply.toString());
        console.error(`Initial supply in wei: ${initialSupplyWei}`);
        console.error('Sending deployment transaction...');
        const hash = yield walletClient.deployContract({
            abi,
            bytecode: bytecode,
            args: [initialSupplyWei], // Pass initial supply to constructor
            account: walletClient.account,
        });
        console.error(`Deployment transaction sent. Hash: ${hash}`);
        console.error('Waiting for transaction receipt...');
        const receipt = yield publicClient.waitForTransactionReceipt({ hash });
        console.error(`Transaction confirmed. Status: ${receipt.status}`);
        if (receipt.status === 'reverted') {
            throw new Error(`Token deployment failed (reverted). Gas used: ${receipt.gasUsed}`);
        }
        if (!receipt.contractAddress) {
            throw new Error('Token deployment succeeded but no contract address found in receipt.');
        }
        const tokenAddress = receipt.contractAddress;
        console.error(`Token '${tokenName}' (${tokenSymbol}) deployed successfully at address: ${tokenAddress}`);
        // Prepare success message with verification details
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
    }
    catch (error) {
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
}));
// Define the 'verify-contract' tool (using Sourcify)
server.tool("verify-contract", "Attempts to automatically verify a deployed contract on the Monad testnet explorer via Sourcify API.", {
    contractAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the deployed contract."),
    contractName: zod_1.z.string().describe("The name of the main contract (without .sol extension)."),
    sourceCode: zod_1.z.string().describe("The full Solidity source code used for deployment."),
    optimizationRuns: zod_1.z.number().int().positive().optional().describe("Number of optimization runs used during deployment (e.g., 200). Leave undefined if optimization was disabled.")
    // constructorArgs: z.array(z.any()).optional().describe("Array of constructor arguments (if any). ABI encoding is handled by some verification services but might need manual input.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ contractAddress, contractName, sourceCode, optimizationRuns /*, constructorArgs */ }) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const sourcifyApiUrl = 'https://sourcify-api-monad.blockvision.org';
    const chainId = monadTestnet.id; // 10143
    try {
        console.error(`Attempting automated verification for ${contractName} at ${contractAddress} on chain ${chainId}`);
        // 1. Check if already verified
        try {
            const checkResponse = yield axios_1.default.get(`${sourcifyApiUrl}/checkByAddresses`, {
                params: { addresses: contractAddress, chainIds: chainId }
            });
            if (checkResponse.data && ((_b = checkResponse.data[0]) === null || _b === void 0 ? void 0 : _b.status) === 'perfect') {
                console.error(`Contract ${contractAddress} is already verified (perfect match).`);
                return { content: [{ type: "text", text: `Contract ${contractAddress} is already verified on Sourcify.` }] };
            }
            else if (checkResponse.data && ((_c = checkResponse.data[0]) === null || _c === void 0 ? void 0 : _c.status) === 'partial') {
                console.error(`Contract ${contractAddress} has a partial match on Sourcify.`);
                // Allow proceeding to attempt full verification
            }
        }
        catch (checkError) {
            // Log check error but proceed with verification attempt
            console.warn(`Sourcify check failed (proceeding with verification attempt): ${checkError.message}`);
        }
        // 2. Compile the contract locally to get metadata
        console.error(`Compiling ${contractName}.sol for verification metadata... Optimization: ${optimizationRuns !== null && optimizationRuns !== void 0 ? optimizationRuns : 'Disabled'}`);
        const { metadata } = compileContract(contractName, sourceCode, optimizationRuns);
        if (!metadata) {
            throw new Error('Failed to retrieve contract metadata during compilation.');
        }
        console.error('Compilation successful, metadata obtained.');
        // 3. Prepare the payload for the Sourcify API
        const payload = {
            address: contractAddress,
            chain: chainId.toString(), // API expects chainId as string
            files: {
                'metadata.json': metadata,
                [`${contractName}.sol`]: sourceCode
            }
        };
        // 4. Send POST request to Sourcify
        console.error(`Submitting verification request to Sourcify API: ${sourcifyApiUrl}`);
        const submitResponse = yield axios_1.default.post(sourcifyApiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.error('Sourcify submission response:', submitResponse.data);
        // 5. Handle response
        if (((_f = (_e = (_d = submitResponse.data) === null || _d === void 0 ? void 0 : _d.result) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.status) === 'perfect') {
            return {
                content: [{ type: "text", text: `Contract ${contractName} (${contractAddress}) successfully verified (perfect match)! Explorer: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
            };
        }
        else if (((_j = (_h = (_g = submitResponse.data) === null || _g === void 0 ? void 0 : _g.result) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.status) === 'partial') {
            return {
                content: [{ type: "text", text: `Contract ${contractName} (${contractAddress}) has a partial match on Sourcify. Metadata might be missing or slightly different. Explorer: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
            };
        }
        else if ((_k = submitResponse.data) === null || _k === void 0 ? void 0 : _k.error) {
            throw new Error(`Sourcify verification failed: ${submitResponse.data.error}`);
        }
        else {
            // Handle cases where verification might be pending
            return {
                content: [{ type: "text", text: `Verification request submitted for ${contractName} (${contractAddress}). Status: ${((_o = (_m = (_l = submitResponse.data) === null || _l === void 0 ? void 0 : _l.result) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.status) || 'Unknown'}. Check the explorer shortly: ${monadTestnet.blockExplorers.default.url}/address/${contractAddress}#contract` }]
            };
        }
    }
    catch (error) {
        console.error(`Error during automated verification for ${contractAddress}:`, error);
        let errorMessage = `Automated verification attempt failed for ${contractName} (${contractAddress}).`;
        if ((_q = (_p = error.response) === null || _p === void 0 ? void 0 : _p.data) === null || _q === void 0 ? void 0 : _q.error) { // Check for specific API error message
            errorMessage += ` Sourcify API Error: ${error.response.data.error}`;
        }
        else if (error.message.includes('compilation failed')) {
            errorMessage += ` Local compilation failed: ${error.message}`;
        }
        else {
            errorMessage += ` Error: ${error.message}`;
        }
        errorMessage += '\n\nPlease ensure the contract name, source code, and optimization settings exactly match the deployed contract.';
        return {
            content: [{ type: "text", text: errorMessage }]
        };
    }
}));
// Define the 'get-transaction-status' tool
server.tool("get-transaction-status", "Checks the status and details of a transaction on Monad testnet using its hash.", { hash: zod_1.z.string().startsWith('0x').length(66).describe("The transaction hash (0x...).") }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ hash }) {
    try {
        console.error(`Checking status for transaction: ${hash}`);
        const receipt = yield publicClient.getTransactionReceipt({ hash: hash }); // Fix type cast
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
        details += `Effective Gas Price: ${(0, viem_1.formatUnits)(receipt.effectiveGasPrice, 9)} Gwei\n`; // Gas price usually in Gwei
        details += `Logs: ${receipt.logs.length} events\n`;
        details += `Explorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
        return {
            content: [{ type: "text", text: details }]
        };
    }
    catch (error) {
        console.error(`Error fetching transaction receipt for ${hash}:`, error);
        // Handle cases where the transaction is not found or still pending
        let errorMessage = `Failed to get receipt for transaction ${hash}.`;
        if (error.message.includes('not found')) {
            errorMessage += ' It might still be pending or the hash is incorrect.';
        }
        else {
            errorMessage += ` Error: ${error.message}`;
        }
        return {
            content: [{ type: "text", text: errorMessage }]
        };
    }
}));
// Define the 'get-block-info' tool
server.tool("get-block-info", "Retrieves information about a specific block on Monad testnet.", {
    blockIdentifier: zod_1.z.union([
        zod_1.z.bigint().describe("The block number."),
        zod_1.z.enum(['latest', 'safe', 'finalized', 'earliest']).describe("A block tag ('latest', 'safe', 'finalized', 'earliest').")
    ]).describe("Block number (as a BigInt) or a block tag string.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ blockIdentifier }) {
    try {
        const param = typeof blockIdentifier === 'bigint'
            ? { blockNumber: blockIdentifier }
            : { blockTag: blockIdentifier };
        console.error(`Fetching block info for: ${blockIdentifier}`);
        const block = yield publicClient.getBlock(param);
        console.error(`Block ${block.number} found.`);
        let details = `Block Number: ${block.number}\n`;
        details += `Hash: ${block.hash}\n`;
        details += `Parent Hash: ${block.parentHash}\n`;
        details += `Timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()} (${block.timestamp})\n`;
        details += `Transactions: ${block.transactions.length}\n`;
        details += `Miner: ${block.miner}\n`;
        details += `Gas Used: ${block.gasUsed}\n`;
        details += `Gas Limit: ${block.gasLimit}\n`;
        details += `Base Fee Per Gas: ${block.baseFeePerGas ? (0, viem_1.formatUnits)(block.baseFeePerGas, 9) + ' Gwei' : 'N/A (Pre-EIP1559)'}\n`;
        details += `Size: ${block.size} bytes\n`;
        details += `Explorer: ${monadTestnet.blockExplorers.default.url}/block/${block.number}`;
        return {
            content: [{ type: "text", text: details }]
        };
    }
    catch (error) {
        console.error(`Error fetching block info for ${blockIdentifier}:`, error);
        return {
            content: [{ type: "text", text: `Failed to retrieve block info for ${blockIdentifier}. Error: ${error.message}` }]
        };
    }
}));
// Define the 'read-contract' tool
server.tool("read-contract", "Reads data from a deployed smart contract using a view or pure function.", {
    contractAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: zod_1.z.any().describe("The contract ABI (Application Binary Interface) as a JSON object or array."),
    functionName: zod_1.z.string().describe("The name of the contract function to call."),
    args: zod_1.z.array(zod_1.z.any()).optional().describe("An array of arguments for the function call (if any).")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ contractAddress, abi, functionName, args }) {
    try {
        console.error(`Reading function '${functionName}' from contract ${contractAddress}`);
        const result = yield publicClient.readContract({
            address: contractAddress,
            abi: abi, // Remove 'as Abi'
            functionName,
            args: args || [],
        });
        console.error(`Read successful. Result: ${result}`);
        // Attempt to format the result nicely
        let formattedResult;
        if (typeof result === 'bigint') {
            formattedResult = result.toString();
        }
        else if (Array.isArray(result)) {
            formattedResult = JSON.stringify(result.map(item => typeof item === 'bigint' ? item.toString() : item));
        }
        else if (typeof result === 'object' && result !== null) {
            // Handle struct-like objects (may contain bigints)
            formattedResult = JSON.stringify(result, (key, value) => typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
            );
        }
        else {
            formattedResult = String(result);
        }
        return {
            content: [{ type: "text", text: `Result from calling '${functionName}':\n${formattedResult}` }]
        };
    }
    catch (error) {
        console.error(`Error reading contract ${contractAddress} function ${functionName}:`, error);
        // Provide more specific ABI/function errors if possible
        let errorMessage = `Failed to read from contract ${contractAddress}.`;
        if (error.message.includes('Invalid ABI') || error.message.includes('Function not found')) {
            errorMessage += ' Check if the ABI is correct and the function exists.';
        }
        else if (error.message.includes('incorrect number of arguments')) {
            errorMessage += ' Check the provided arguments.';
        }
        else {
            errorMessage += ` Error: ${error.message}`;
        }
        return {
            content: [{ type: "text", text: errorMessage }]
        };
    }
}));
// Define the 'write-contract' tool
server.tool("write-contract", "Sends a transaction to a smart contract to execute a state-changing function.", {
    contractAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: zod_1.z.any().describe("The contract ABI (Application Binary Interface) as a JSON object or array."),
    functionName: zod_1.z.string().describe("The name of the contract function to call."),
    args: zod_1.z.array(zod_1.z.any()).optional().describe("An array of arguments for the function call (if any)."),
    privateKey: zod_1.z.string().describe("The private key (0x...) of the account sending the transaction. WARNING: Handle with care!"),
    value: zod_1.z.string().optional().describe("Amount of MON to send with the transaction (e.g., '0.1'). Optional.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ contractAddress, abi, functionName, args, privateKey, value }) {
    try {

        const walletClient = privateKey ? getWallet(privateKey) : getContextWallet();
        const senderAddress = walletClient.account.address;
        console.error(`Preparing to call function '${functionName}' on contract ${contractAddress} from ${senderAddress}`);
        const txValue = value ? (0, viem_1.parseEther)(value) : undefined;
        console.error('Sending transaction...');
        const hash = yield walletClient.writeContract({
            address: contractAddress,
            abi: abi,
            functionName,
            args: args || [],
            account: walletClient.account,
            value: txValue,
            chain: monadTestnet
        });
        console.error(`Transaction sent. Hash: ${hash}`);
        // Don't wait for receipt here, just return the hash
        return {
            content: [{
                    type: "text",
                    text: `Transaction sent successfully!\nFunction: ${functionName}\nFrom: ${senderAddress}\nTo: ${contractAddress}\nHash: ${hash}\nExplorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}\n\nUse the 'get-transaction-status' tool with the hash to check its confirmation.`
                }]
        };
    }
    catch (error) {
        console.error(`Error writing to contract ${contractAddress} function ${functionName}:`, error);
        return {
            content: [{ type: "text", text: `Failed to send transaction. Error: ${error.message}` }]
        };
    }
}));
// Define the 'transfer-mon' tool
server.tool("transfer-mon", "Transfers native MON tokens from the sender (private key or context) to a recipient address.", {
    recipientAddress: zod_1.z.string().startsWith('0x').length(42).describe("The recipient's Monad address (0x...)."),
    amount: zod_1.z.string().describe("The amount of MON to send (e.g., '0.5', '10')."),
    privateKey: zod_1.z.string().optional().describe("Sender's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ recipientAddress, amount, privateKey }) {
    try {
        const walletClient = privateKey ? getWallet(privateKey) : getContextWallet();
        const senderAddress = walletClient.account.address;
        console.error(`Preparing to transfer ${amount} MON from ${senderAddress} to ${recipientAddress}`);
        const valueWei = (0, viem_1.parseEther)(amount);
        console.error('Sending MON transfer transaction...');
        const hash = yield walletClient.sendTransaction({
            account: walletClient.account,
            to: recipientAddress,
            value: valueWei,
            chain: monadTestnet // Explicitly set chain
        });
        console.error(`Transaction sent. Hash: ${hash}`);
        return {
            content: [{
                    type: "text",
                    text: `Successfully sent ${amount} MON from ${senderAddress} to ${recipientAddress}.\nTransaction Hash: ${hash}\nExplorer: ${monadTestnet.blockExplorers.default.url}/tx/${hash}\n\nUse 'get-transaction-status' to check confirmation.`
                }]
        };
    }
    catch (error) {
        console.error(`Error transferring MON to ${recipientAddress}:`, error);
        return {
            content: [{ type: "text", text: `Failed to transfer MON. Error: ${error.message}` }]
        };
    }
}));
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
]; // Use 'as const' for better type inference
server.tool("transfer-erc20", "Transfers ERC20 tokens from the sender (private key or context) to a recipient address.", {
    tokenContractAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the ERC20 token contract."),
    recipientAddress: zod_1.z.string().startsWith('0x').length(42).describe("The recipient's address (0x...)."),
    amount: zod_1.z.string().describe("The amount of tokens to send (in standard units, e.g., '100'). Decimals are handled automatically."),
    privateKey: zod_1.z.string().optional().describe("Sender's private key (0x...). If omitted, uses the key from session context. WARNING: Handle with care!")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ tokenContractAddress, recipientAddress, amount, privateKey }) {
    try {
        const walletClient = privateKey ? getWallet(privateKey) : getContextWallet();
        const senderAddress = walletClient.account.address;
        console.error(`Preparing to transfer ${amount} tokens from ${tokenContractAddress} to ${recipientAddress} from sender ${senderAddress}`);
        // Get token decimals to parse amount correctly
        const decimals = yield publicClient.readContract({
            address: tokenContractAddress,
            abi: erc20TransferAbi,
            functionName: 'decimals',
        });
        console.error(`Token decimals: ${decimals}`);
        const amountWei = (0, viem_1.parseUnits)(amount, decimals);
        console.error('Sending ERC20 transfer transaction...');
        const hash = yield walletClient.writeContract({
            address: tokenContractAddress,
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [recipientAddress, amountWei],
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
    }
    catch (error) {
        console.error(`Error transferring ERC20 token ${tokenContractAddress} to ${recipientAddress}:`, error);
        return {
            content: [{ type: "text", text: `Failed to send ERC20 transfer transaction. Error: ${error.message}` }]
        };
    }
}));
// Define the 'estimate-gas' tool
server.tool("estimate-gas", "Estimates the gas cost for a contract function call.", {
    contractAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the contract."),
    abi: zod_1.z.any().describe("The contract ABI as a JSON object or array."),
    functionName: zod_1.z.string().describe("The name of the contract function."),
    args: zod_1.z.array(zod_1.z.any()).optional().describe("An array of arguments for the function call."),
    accountAddress: zod_1.z.string().startsWith('0x').length(42).describe("The address of the account that would send the transaction."),
    value: zod_1.z.string().optional().describe("Amount of MON to send (e.g., '0.1'). Optional.")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ contractAddress, abi, functionName, args, accountAddress, value }) {
    try {
        console.error(`Estimating gas for ${functionName} on ${contractAddress} from ${accountAddress}`);
        const txValue = value ? (0, viem_1.parseEther)(value) : undefined;
        const estimatedGas = yield publicClient.estimateContractGas({
            address: contractAddress,
            abi: abi, // Remove 'as Abi'
            functionName,
            args: args || [],
            account: accountAddress,
            value: txValue
        });
        console.error(`Estimated gas: ${estimatedGas}`);
        // Also fetch current gas price for a cost estimate
        const gasPrice = yield publicClient.getGasPrice();
        const estimatedCost = estimatedGas * gasPrice;
        return {
            content: [{
                    type: "text",
                    text: `Estimated gas for calling '${functionName}': ${estimatedGas}\nCurrent Gas Price: ${(0, viem_1.formatUnits)(gasPrice, 9)} Gwei\nEstimated Cost: ~${(0, viem_1.formatUnits)(estimatedCost, 18)} MON`
                }]
        };
    }
    catch (error) {
        console.error(`Error estimating gas for ${contractAddress} function ${functionName}:`, error);
        // Provide more specific errors if possible
        let errorMessage = `Failed to estimate gas for ${functionName}.`;
        if (error.message.includes('execution reverted')) {
            errorMessage += ' The transaction would likely fail. Check arguments, contract state, or sender balance.';
        }
        else {
            errorMessage += ` Error: ${error.message}`;
        }
        return {
            content: [{ type: "text", text: errorMessage }]
        };
    }
}));
// Start the server
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const transport = new stdio_js_1.StdioServerTransport();
        yield server.connect(transport);
        // Use console.error for status messages to avoid interfering with stdio JSON-RPC
        console.error('Monad MCP Server started and listening on stdio...');
    });
}
startServer().catch(error => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});

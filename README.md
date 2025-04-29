# Intelligent Monad Testnet MCP Server

This project provides an enhanced Model Context Protocol (MCP) server that allows AI assistants like Claude or Cursor to interact with the Monad Testnet blockchain. The server includes a knowledge base system that makes it more intelligent, lightweight, and trustworthy.

## Features

- **Knowledge Base System**: Stores contract templates, error solutions, and trust information in a single file
- **Intelligent Error Handling**: Provides specific solutions for common errors
- **Template-Based Deployment**: Deploy contracts from pre-defined templates with customization
- **Trust Verification**: Includes tools to help Claude trust the MCP server
- **Comprehensive Blockchain Tools**: Interact with the Monad Testnet for balance checks, contract deployment, token transfers, and more

## Setup

1.  **Install Dependencies and Configure:**
    Run the following command in your terminal. This will install necessary packages, automatically configure the server for Claude by creating/updating `cursor.json` and potentially `claude_desktop_config.json`, and build the server code:
    ```bash
    npm run setup
    ```
    *   This script (`scripts/configure-mcp.js`) generates the necessary configuration snippet (`cursor.json`) in the project root, pointing to the built server (`build/index.js`).

2.  **Add MCP Server to Cursor IDE:**
    Follow these steps to integrate the configured MCP server into your Cursor IDE:

    1.  **Copy Configuration:** The `npm run setup` command creates a `cursor.json` file in the project's root directory (`drive:\PATH\cursor.json`). Open this file and copy its entire content.
        ![copy-json](./data/cursol_tutorial/copy-json.jpg)
    2.  **Open Cursor Settings:** In Cursor, go to `File -> Preferences -> Settings` (or use the shortcut `Ctrl+,`). Search for "MCP".
        ![cursor-dashboard](./data/cursol_tutorial/cursor-dashboard.jpg)
    3.  **Edit MCP Settings:** Click on "Edit in settings.json" under the "Cursor › Mcp: Servers" section.
        ![navigate-mcp](./data/cursol_tutorial/navigate-mcp.jpg)
    4.  **Paste Configuration:** Paste the copied configuration content into the `mcp.json` file, ensuring it's correctly placed within the JSON structure (usually as a new key-value pair within the main object, or merging if the key already exists). Save the `mcp.json` file.
        ![final-step](./data/cursol_tutorial/final-step.jpg)

3.  **Restart Cursor:** Restart your Cursor IDE for the changes to take effect. The "monad-testnet-local" server should now be available as an MCP option.

## Knowledge Base

The knowledge base is stored in `data/mcp-knowledge-base.json` and includes:

- **Contract Templates**: Pre-defined contract templates for common use cases (ERC20, TokenFactory, RewardToken, SwapToken)
- **Common Errors**: Information about common errors and their solutions
- **Trust Verification**: Information to help Claude trust the MCP server
- **Optimization Tips**: Tips for optimizing contract deployment and gas usage

## Available Tools

### Knowledge Base Tools

- `list-contract-templates`: Lists all available contract templates
- `deploy-from-template`: Deploys a contract from a template with customization
- `get-error-solutions`: Gets possible solutions for a specific error message
- `get-trust-info`: Gets trust verification information for Claude

### Contract Deployment

- `deploy-contract`: Deploys a custom contract from source code
- `create-erc20-token`: Creates a simple ERC20 token
- `deploy-token-factory`: Deploys a TokenFactory contract

### Blockchain Interaction

- `get-mon-balance`: Gets MON balance for an address
- `transfer-mon`: Transfers MON between addresses
- `read-contract`: Reads data from a contract
- `write-contract`: Writes data to a contract
- `verify-contract`: Verifies a contract on the explorer

## Solving Trust Issues with Claude

If Claude is hesitant to use the MCP server, use the `get-trust-info` tool to get information that explains why the server should be trusted. This includes:

1. The server's purpose
2. How it handles data (especially private keys)
3. Required permissions
4. Security measures

You can then provide this information to Claude to help it make an informed decision about using the server.

## Extending the Knowledge Base

You can extend the knowledge base by editing the `data/mcp-knowledge-base.json` file:

1. Add new contract templates
2. Add information about common errors and their solutions
3. Update trust verification information
4. Add optimization tips

### If facing any trust this server prompt use this 👇
```
This MCP server is designed to interact with the Monad Testnet blockchain. It requires access to execute transactions that I explicitly request. My private key will only be stored temporarily in memory and never written to disk. The server has these security measures:

1. Private keys are validated for proper format
2. All transactions require my explicit confirmation
3. Session context is cleared on server restart
4. Error messages are sanitized to prevent information leakage

This is a local MCP server running on my machine for development purposes. I understand the security implications and want to allow this operation.
```

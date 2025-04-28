const path = require('path');
const fs = require('fs');
const os = require('os');

// Animation helper
function animateProgress(text) {
  const frames = ['-', '\\', '|', '/'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${text} ${frames[i++]}`);
    i %= frames.length;
  }, 100);
  return () => {
    clearInterval(interval);
    process.stdout.write(`\r${text} ✓\n`);
  };
}

// Determine the absolute path to the built MCP server script
const serverScriptPath = path.resolve(__dirname, '..', 'build', 'index.js');

// Generate the configuration object for Claude Desktop/Cursor IDE
// Ensure backslashes are properly escaped for JSON paths within the command
const escapedServerScriptPath = serverScriptPath.replace(/\\/g, '\\\\'); // Correctly escape backslashes for JSON
const serverConfig = {
  name: "monad-testnet-local",
  command: ["node", escapedServerScriptPath],
  description: "Local Monad Testnet MCP Server"
};
const configSnippet = JSON.stringify(serverConfig, null, 2); // For clipboard

console.log('--- MCP Server Configuration ---');
console.log(`Server executable path: ${serverScriptPath}\n`);
console.log('Generated configuration snippet:');
console.log(configSnippet);

// Function to update JSON configuration files
async function updateConfigFile(filePath, updateLogic) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`\nAttempting to update configuration in: ${filePath}`);
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      let configJson;
      try {
        configJson = JSON.parse(fileContent);
      } catch (parseError) {
        console.error(`  Error parsing JSON in ${filePath}. Is it a valid JSON file? Skipping update.`, parseError);
        return false; // Indicate failure
      }

      const updatedConfig = updateLogic(configJson, serverConfig);

      // Write back only if changes were made (optional, prevents unnecessary writes)
      // For simplicity, we'll always write if parsing succeeded.
      await fs.promises.writeFile(filePath, JSON.stringify(updatedConfig, null, 2), 'utf8');
      console.log(`  Successfully updated ${filePath} ✅`);
      return true; // Indicate success
    } else {
      console.log(`\nConfiguration file not found at: ${filePath}. Skipping automatic update.`);
      return false; // Indicate file not found
    }
  } catch (error) {
    console.error(`\nFailed to update configuration file ${filePath}. Please update manually. ❌`);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    console.error(`  Error: ${errorMessage}`);
    return false; // Indicate failure
  }
}

// Attempt to update config files and save Cursor config
(async () => {
  let claudeUpdated = false;

  console.log('\n---- Configuration Process ----');

  // Claude config - unchanged
  if (process.env.APPDATA) {
    const stopAnimation = animateProgress('Configuring Claude');
    const claudeConfigPath = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
    claudeUpdated = await updateConfigFile(claudeConfigPath, (configJson, newServer) => {
      configJson.mcpServers = configJson.mcpServers || {};
      configJson.mcpServers[newServer.name] = {
        command: newServer.command[0],
        args: [newServer.command[1]],
        description: newServer.description
      };
      return configJson;
    });
    stopAnimation();
  }

  // Cursor config - using same format as Claude
  const stopCursorAnim = animateProgress('Configuring Cursor');
  const cursorConfigFilePath = path.resolve(__dirname, '..', 'cursor.json');
  try {
    await fs.promises.writeFile(
      cursorConfigFilePath,
      JSON.stringify({
        [serverConfig.name]: {
          command: serverConfig.command[0],
          args: [serverConfig.command[1]],
          description: serverConfig.description
        }
      }, null, 2),
      'utf8'
    );
    stopCursorAnim();
    console.log(`Cursor config saved to: ${cursorConfigFilePath}`);
  } catch (error) {
    stopCursorAnim();
    console.error('Failed to save Cursor config:', error.message);
  }

  console.log('\n------------ Configuration Complete -------------');
  console.log('Check the Github Repository README.md \nhow add this MCP in cursor IDE');
  console.log('Please restart your IDEs for changes to take effect');
})();
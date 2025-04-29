import fs from 'fs';
import path from 'path';

/**
 * Knowledge base manager for the MCP server
 * Loads and provides access to contract templates, error solutions, and other knowledge
 */
export class KnowledgeBase {
  private data: any;
  private static instance: KnowledgeBase;

  private constructor() {
    try {
      const knowledgeBasePath = path.resolve(__dirname, '../data/mcp-knowledge-base.json');
      const fileContent = fs.readFileSync(knowledgeBasePath, 'utf8');
      this.data = JSON.parse(fileContent);
      console.error(`Knowledge base loaded: version ${this.data.version}`);
    } catch (error: any) {
      console.error(`Failed to load knowledge base: ${error.message}`);
      // Initialize with empty data if file can't be loaded
      this.data = {
        version: "0.0.0",
        contractTemplates: {},
        commonErrors: {},
        trustVerification: {},
        optimizationTips: {}
      };
    }
  }

  /**
   * Get the singleton instance of the knowledge base
   */
  public static getInstance(): KnowledgeBase {
    if (!KnowledgeBase.instance) {
      KnowledgeBase.instance = new KnowledgeBase();
    }
    return KnowledgeBase.instance;
  }

  /**
   * Get a contract template by name
   * @param templateName The name of the template to retrieve
   * @returns The contract template or undefined if not found
   */
  public getContractTemplate(templateName: string): any {
    const templates = this.data.contractTemplates || {};
    return templates[templateName];
  }

  /**
   * Get all available contract templates
   * @returns Object containing all contract templates
   */
  public getAllContractTemplates(): any {
    return this.data.contractTemplates || {};
  }

  /**
   * Get information about a common error
   * @param errorType The type of error to look up
   * @returns Information about the error or undefined if not found
   */
  public getErrorInfo(errorType: string): any {
    const errors = this.data.commonErrors || {};
    return errors[errorType];
  }

  /**
   * Get trust verification information
   * @returns Trust verification information
   */
  public getTrustInfo(): any {
    return this.data.trustVerification || {};
  }

  /**
   * Get optimization tips
   * @param category Optional category of tips to retrieve
   * @returns Optimization tips for the specified category or all tips
   */
  public getOptimizationTips(category?: string): any {
    const tips = this.data.optimizationTips || {};
    if (category && tips[category]) {
      return tips[category];
    }
    return tips;
  }

  /**
   * Find solutions for a specific error message
   * @param errorMessage The error message to analyze
   * @returns Array of possible solutions
   */
  public findErrorSolutions(errorMessage: string): string[] {
    const errors = this.data.commonErrors || {};
    const solutions: string[] = [];
    
    // Convert error message to lowercase for case-insensitive matching
    const lowerErrorMsg = errorMessage.toLowerCase();
    
    // Check each error type for relevant keywords
    Object.values(errors).forEach((error: any) => {
      // Check if any of the causes match the error message
      const matchesCause = error.causes.some((cause: string) => 
        lowerErrorMsg.includes(cause.toLowerCase())
      );
      
      if (matchesCause) {
        // Add all solutions for this error type
        solutions.push(...error.solutions);
      }
    });
    
    return solutions.length > 0 ? solutions : ["No specific solutions found in knowledge base."];
  }

  /**
   * Get a contract template source by name with customized parameters
   * @param templateName The name of the template
   * @param params Parameters to customize the template (e.g., token name, symbol)
   * @returns The customized contract source code
   */
  public getCustomizedContractSource(templateName: string, params: Record<string, string>): string {
    const template = this.getContractTemplate(templateName);
    if (!template) {
      throw new Error(`Contract template '${templateName}' not found`);
    }
    
    let source = template.source;
    
    // Replace placeholders in the source code
    Object.entries(params).forEach(([key, value]) => {
      // Create a regex that matches the placeholder in various formats
      // e.g., TokenName, TOKEN_NAME, tokenName
      const camelCase = key.charAt(0).toLowerCase() + key.slice(1);
      const pascalCase = key.charAt(0).toUpperCase() + key.slice(1);
      const snakeCase = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      
      source = source.replace(new RegExp(camelCase, 'g'), value);
      source = source.replace(new RegExp(pascalCase, 'g'), value);
      source = source.replace(new RegExp(snakeCase, 'g'), value);
    });
    
    return source;
  }

  /**
   * Generate a trust verification message for Claude
   * @returns A trust verification message
   */
  public generateTrustMessage(): string {
    const trustInfo = this.getTrustInfo();
    return trustInfo.trustPrompt || 
      "This MCP server needs permission to interact with the Monad blockchain on your behalf. Do you want to allow this?";
  }
}

// Export the singleton instance
export const knowledgeBase = KnowledgeBase.getInstance();

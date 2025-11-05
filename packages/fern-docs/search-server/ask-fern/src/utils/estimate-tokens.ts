import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

// Initialize the tokenizer with cl100k_base encoding (used by GPT-4/GPT-3.5-turbo)
// This provides a good approximation for Claude models as well
const encoding = new Tiktoken(cl100k_base);

/**
 * Counts the number of tokens in a given text using tiktoken's cl100k_base encoding.
 * This encoding is used by GPT-4 and provides a reasonable approximation for Claude models.
 *
 * @param text - The text to count tokens for
 * @returns Number of tokens
 */
export function estimateTokens(text: string): number {
    return encoding.encode(text).length;
}

/**
 * Counts the total number of tokens in an array of strings.
 *
 * @param texts - Array of text strings
 * @returns Total number of tokens
 */
export function estimateTokensFromArray(texts: string[]): number {
    return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

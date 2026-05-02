declare module "input" {
  /**
   * Prompt user for text input in terminal
   */
  export function text(prompt: string): Promise<string>;

  /**
   * Prompt user for password input (hidden) in terminal
   */
  export function password(prompt: string): Promise<string>;

  /**
   * Prompt user for confirmation (yes/no)
   */
  export function confirm(prompt: string): Promise<boolean>;
}

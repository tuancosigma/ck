/**
 * Recursively resolves nested expressions within string variables.
 * E.g., dynamic parameters like "{{ node_1.statusCode }}" or "{{ $json.items[0].id }}"
 */
export class ExpressionResolver {
  /**
   * Resolves a path (e.g., "node_1.data.message") against the input context.
   */
  public static getValueByPath(path: string, input: any): any {
    const trimmedPath = path.trim();
    if (!trimmedPath) return undefined;

    // Check if the path is a complex expression (contains methods, operators, or string manipulation)
    const isComplex = /[\(\)\+\-\*\/]/.test(trimmedPath) || trimmedPath.includes(".replace") || trimmedPath.includes(".substring") || trimmedPath.includes(".slice");
    if (isComplex) {
      try {
        const parentKeys = Object.keys(input || {});
        const parentKey = parentKeys.includes("trigger") ? "trigger" : parentKeys[0];
        const $json = parentKey ? input[parentKey] : {};
        
        // Safely evaluate the expression inside a function scope
        const fn = new Function('$json', 'input', `try { return ${trimmedPath}; } catch(e) { return undefined; }`);
        return fn($json, input);
      } catch (e) {
        // Fallback to standard dot-split parser
      }
    }

    // Split path by dots (simple parser, handles nested objects)
    const keys = trimmedPath.replace(/\[(\w+)\]/g, ".$1").split(".");
    let current: any = input;

    // Handle $json shortcut
    // If the path starts with "$json", we bind it to the first available parent's output.
    if (keys[0] === "$json") {
      const parentKeys = Object.keys(input || {});
      if (parentKeys.length > 0) {
        // If there's an explicit "trigger" payload, we prefer that. Otherwise, the first parent node.
        const parentKey = parentKeys.includes("trigger") ? "trigger" : parentKeys[0];
        current = input[parentKey];
        keys.shift(); // Remove "$json"
      } else {
        return undefined;
      }
    }

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Evaluates a string. If it is a full expression like "{{ path }}", resolves it.
   * If it contains embedded expressions (e.g. "Bearer {{ node_1.token }}"), interpolates them.
   */
  public static resolveString(str: any, input: any): any {
    if (typeof str !== "string") {
      return str;
    }
    const fullExprRegex = /^\{\{\s*(.*?)\s*\}\}$/;
    const embedExprRegex = /\{\{\s*(.*?)\s*\}\}/g;

    // 1. Check if the string is exactly a single full expression (so we can return raw types like numbers/boolean)
    const fullMatch = str.match(fullExprRegex);
    if (fullMatch) {
      return this.getValueByPath(fullMatch[1], input);
    }

    // 2. Interpolate embedded expressions into string
    return str.replace(embedExprRegex, (match, path) => {
      const val = this.getValueByPath(path, input);
      if (val === undefined || val === null) return "";
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    });
  }

  /**
   * Recursively traverses any configuration value and resolves any string expressions.
   */
  public static resolve(configValue: any, input: any): any {
    if (configValue === null || configValue === undefined) {
      return configValue;
    }

    if (typeof configValue === "string") {
      return this.resolveString(configValue, input);
    }

    if (Array.isArray(configValue)) {
      return configValue.map((item) => this.resolve(item, input));
    }

    if (typeof configValue === "object") {
      const resolvedObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(configValue)) {
        resolvedObj[key] = this.resolve(val, input);
      }
      return resolvedObj;
    }

    return configValue;
  }
}

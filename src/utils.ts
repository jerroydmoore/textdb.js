export function getCallee(error = new Error('foo'), lineno = 3): string | undefined {
  const stackOrigin = error.stack?.split('\n')[lineno];
  const match = stackOrigin?.match(/^\s*at\s+([^.\s]+\.)?([^\s]+)/);
  if (match) {
    return match[2];
  }
}

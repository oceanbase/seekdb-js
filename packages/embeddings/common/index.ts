const convertToSnake = (str: string): string => {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
};

export const toSnake = (input: any): any => {
  if (Array.isArray(input)) {
    return input.map(toSnake);
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        convertToSnake(key),
        toSnake(value),
      ]),
    );
  }

  return input;
};

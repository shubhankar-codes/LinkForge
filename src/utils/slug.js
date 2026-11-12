// Character set for Base62 encoding
const CHAR = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Convert a non-negative integer to Base62
function toBase62(num) {
  if (
    typeof num !== "number" ||
    !Number.isInteger(num) ||
    num < 0
  ) {
    throw new Error(
      `toBase62 expects a non-negative integer, got: ${num}`
    );
  }

  if (num === 0) {
    return CHAR[0];
  }

  let result = "";

  while (num > 0) {
    result = CHAR[num % 62] + result;
    num = Math.floor(num / 62);
  }

  return result;
}

// Convert Base62 back to an integer
function fromBase62(str) {
  if (typeof str !== "string" || str.length === 0) {
    throw new Error("Invalid Base62 string");
  }

  let result = 0;

  for (const ch of str) {
    const index = CHAR.indexOf(ch);

    if (index === -1) {
      throw new Error(`Invalid Base62 character: ${ch}`);
    }

    result = result * 62 + index;
  }

  return result;
}

// Generate a fixed-width slug from a database ID
function generateSlug(id) {
  return toBase62(id).padStart(4, "0");
}

module.exports = {
  CHAR,
  toBase62,
  fromBase62,
  generateSlug,
};
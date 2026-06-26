//Character set for base62 encoding
const CHAR = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';


//toBase62(num)
function toBase62(num) {
  if(typeof num !== 'number' || num < 0 || !Number.isInteger(num)) {
    throw new Error(`toBase62 expects  a non-negative integer, got; ${num}`);
}
if(num === 0) return CHAR[0];

let result = '';
while(num > 0) {
  result = CHAR[num % 62] + result ; //prepend - remainder is least significant digit
  num = Math.floor(num / 62);
}
return result;
}

/* from Base62(str)
(reverse the process of toBase62, converting a base62 string back to a number) */

function fromBase62(str) {
  let result = 0;
  for(const char of str) {
    const index = CHAR.indexOf(char);
    if(index === -1) 
    throw new Error(`Invalid character '${char}' in base62 string`);
    result = result * 62 + index;
  }
  return result;
}

//generating a random slug of given length
function generateSlug(id) {
  const base = toBase62(id);

  return base.padStart(4, '0');
}

module.exports = {toBase62, fromBase62, generateSlug, CHAR };
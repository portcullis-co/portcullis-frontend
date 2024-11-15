const crypto = require('crypto');

// Generate a random 256-bit key (32 bytes)
const key = crypto.randomBytes(32).toString('hex'); // Key in hexadecimal format
console.log(key); // Hexadecimal key output

// Check the length in bytes (should be 32 bytes) and bits (should be 256 bits)
console.log(`Key length in bytes: ${key.length / 2}`); // Divide by 2 because 2 hex digits = 1 byte
console.log(`Key length in bits: ${key.length * 4}`); // 1 hex character = 4 bits

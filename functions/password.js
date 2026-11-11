const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;
const cost = 32768;
const blockSize = 8;
const parallelization = 1;
const options = {
  N: cost,
  r: blockSize,
  p: parallelization,
  maxmem: 64 * 1024 * 1024,
};

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, keyLength, options);

  return [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password, storedHash) {
  const [algorithm, storedCost, storedBlockSize, storedParallelization, salt, key] =
    storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    Number(storedCost) !== cost ||
    Number(storedBlockSize) !== blockSize ||
    Number(storedParallelization) !== parallelization ||
    !salt ||
    !key
  ) {
    return false;
  }

  const expectedKey = Buffer.from(key, "base64url");
  const actualKey = await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    expectedKey.length,
    options
  );

  return (
    expectedKey.length === actualKey.length &&
    crypto.timingSafeEqual(expectedKey, actualKey)
  );
}

module.exports = { hashPassword, verifyPassword };

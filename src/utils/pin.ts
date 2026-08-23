type PinCredentials = {
  pinHash: string;
  pinSalt: string;
};

function randomSalt(length = 16): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function sha256(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  const isComposite: Record<number, boolean> = {};
  let primeCounter = 0;

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let multiple = candidate * candidate; multiple < 312; multiple += candidate) {
        isComposite[multiple] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) !== 56) {
    ascii += '\x00';
  }

  for (let index = 0; index < ascii.length; index += 1) {
    const charCode = ascii.charCodeAt(index);
    words[index >> 2] |= charCode << (((3 - index) % 4) * 8);
  }

  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let start = 0; start < words.length; ) {
    const w = words.slice(start, (start += 16));
    const oldHash = hash.slice(0);

    for (let index = 0; index < 64; index += 1) {
      const w15 = w[index - 15];
      const w2 = w[index - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[index] +
        (w[index] =
          index < 16
            ? w[index]
            : (w[index - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[index - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let index = 0; index < 8; index += 1) {
      hash[index] = (hash[index] + oldHash[index]) | 0;
    }
  }

  for (let index = 0; index < 8; index += 1) {
    for (let shift = 3; shift >= 0; shift -= 1) {
      const value = (hash[index] >> (shift * 8)) & 255;
      result += (value < 16 ? '0' : '') + value.toString(16);
    }
  }

  return result;
}

export function createPinCredentials(pin: string): PinCredentials {
  const pinSalt = randomSalt();
  return {
    pinSalt,
    pinHash: sha256(`${pinSalt}:${pin.trim()}`),
  };
}

export function verifyPin({
  pin,
  pinHash,
  pinSalt,
}: {
  pin: string;
  pinHash: string;
  pinSalt: string;
}): boolean {
  return sha256(`${pinSalt}:${pin.trim()}`) === pinHash;
}

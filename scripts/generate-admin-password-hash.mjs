import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { stdin, stdout } from "node:process";
import readline from "node:readline";

const scrypt = promisify(scryptCallback);

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (value) => {
      if (rl.stdoutMuted) {
        if (value.includes("\n")) originalWrite(value);
        else originalWrite("*");
      } else {
        originalWrite(value);
      }
    };
    rl.stdoutMuted = true;
    rl.question(prompt, (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      resolve(answer);
    });
    rl.on("SIGINT", () => {
      rl.close();
      reject(new Error("Password prompt cancelled."));
    });
  });
}

const password = await readHidden("New administrator password (min 14 characters): ");
if (password.length < 14) {
  console.error("\nPassword must be at least 14 characters.");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const digest = await scrypt(password, salt, 64);
  console.log(`\nADMIN_PASSWORD_HASH=scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`);
}

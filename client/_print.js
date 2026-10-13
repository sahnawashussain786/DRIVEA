import { readFileSync } from "fs";
const lines = readFileSync("src/assets/api.js", "utf8").split("\n");
for (let i = 143; i < 215; i++) {
  if (lines[i] !== undefined) console.log(i + 1 + " " + lines[i]);
}

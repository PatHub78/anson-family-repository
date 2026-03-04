const fs = require("fs");

const raw = fs.readFileSync("en_full.txt", "utf8").split("\n");

const clean = raw
  .slice(0, 113279)                 // how many words you want
  .map(line => line.split(" ")[0]) // remove number
  .filter(w => /^[a-z]+$/.test(w));

fs.writeFileSync("public/words.txt", clean.join("\n"));

console.log("done");
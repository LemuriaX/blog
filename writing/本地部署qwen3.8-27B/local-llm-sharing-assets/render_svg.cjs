// Re-render the four revised source diagrams. Requires sharp; an explicit module path is optional.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
async function main() {
  for (const name of ['deployment-stack', 'vram-budget', 'inference-pipeline', 'ar-vs-diffusion']) {
    const source = path.join(__dirname, name + '.svg');
    const output = path.join(__dirname, name + '.png');
    await sharp(fs.readFileSync(source)).png().toFile(output);
    process.stdout.write(output + '\n');
  }
}
main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });

const fs = require('fs');
const content = fs.readFileSync('profile.ttl', 'utf8');
const lines = content.split('\n');

function extractProperty(line) {
  const trimmed = line.trim();
  const withoutComment = trimmed.startsWith('#') ? trimmed.substring(1).trim() : trimmed;

  if (!withoutComment || withoutComment.startsWith('@prefix') || withoutComment.startsWith('@base')) {
    return null;
  }

  const match = withoutComment.match(/^([^\s]+)/);
  const property = match ? match[1] : null;

  if (property && property.startsWith('rda')) {
    return property;
  }
  return null;
}

console.log('Testing property extraction:');
let testLines = [141, 303, 1184]; // 0-indexed
testLines.forEach(i => {
  const line = lines[i];
  const property = extractProperty(line);
  console.log(`Line ${i+1}: property="${property}" | line="${line.substring(0, 60)}"`);
});

console.log('\nBuilding property map...');
const propertyMap = new Map();

lines.forEach((line, index) => {
  const property = extractProperty(line);
  if (property) {
    if (!propertyMap.has(property)) {
      propertyMap.set(property, []);
    }
    propertyMap.get(property).push(index);
  }
});

console.log('\nChecking rdawo:P10319:');
if (propertyMap.has('rdawo:P10319')) {
  const indices = propertyMap.get('rdawo:P10319');
  console.log(`  Found on lines: ${indices.map(i => i + 1).join(', ')}`);
} else {
  console.log('  NOT FOUND in map');
}

console.log('\nTotal properties in map:', propertyMap.size);
console.log('Properties with duplicates:', Array.from(propertyMap.entries()).filter(([k, v]) => v.length > 1).length);

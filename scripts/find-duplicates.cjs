#!/usr/bin/env node

/**
 * Script to find and tag duplicate RDA properties in profile.ttl
 *
 * Usage: node find-duplicates.cjs
 *
 * This script:
 * 1. Reads profile.ttl line by line
 * 2. Extracts RDA properties (those starting with "rda", ignoring leading # comments)
 * 3. Identifies duplicate properties
 * 4. Tags duplicate lines with @@@ at the start (EXCEPT the first occurrence)
 * 5. Writes the result to profile-tagged.ttl
 *
 * The first occurrence of each property is left untagged (to keep),
 * while subsequent duplicates are tagged with @@@ (to review/delete).
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'profile.ttl');
const outputFile = path.join(__dirname, 'profile-tagged.ttl');

// Read the file
console.log('Reading profile.ttl...');
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Extract property from a line (ignoring leading #)
function extractProperty(line) {
  // Remove leading whitespace and comment marker
  const trimmed = line.trim();
  const withoutComment = trimmed.startsWith('#') ? trimmed.substring(1).trim() : trimmed;

  // Skip empty lines, prefix declarations
  if (!withoutComment ||
      withoutComment.startsWith('@prefix') ||
      withoutComment.startsWith('@base')) {
    return null;
  }

  // Extract the property (first token before whitespace)
  const match = withoutComment.match(/^([^\s]+)/);
  const property = match ? match[1] : null;

  // Only process properties that start with "rda"
  if (property && property.startsWith('rda')) {
    return property;
  }

  return null;
}

// Build a map of property -> line indices
console.log('Analyzing properties...');
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

// Find duplicates
const duplicateIndices = new Set();
let duplicateCount = 0;

propertyMap.forEach((indices, property) => {
  if (indices.length > 1) {
    duplicateCount++;
    console.log(`\nDuplicate property: ${property}`);
    console.log(`  Found on lines: ${indices.map(i => i + 1).join(', ')}`);
    console.log(`  First occurrence (KEEP): line ${indices[0] + 1}`);
    console.log(`  Duplicate occurrences (TAG): lines ${indices.slice(1).map(i => i + 1).join(', ')}`);
    // Skip first occurrence, only tag subsequent duplicates
    indices.slice(1).forEach(idx => duplicateIndices.add(idx));
  }
});

console.log(`\nTotal duplicate properties found: ${duplicateCount}`);
console.log(`Total lines with duplicates: ${duplicateIndices.size}`);

// Tag duplicate lines
console.log('\nTagging duplicate lines...');
const taggedLines = lines.map((line, index) => {
  if (duplicateIndices.has(index)) {
    // Add @@@ at the start of the line
    return '@@@ ' + line;
  }
  return line;
});

// Write output
console.log(`\nWriting to ${outputFile}...`);
fs.writeFileSync(outputFile, taggedLines.join('\n'), 'utf8');

console.log('Done! Check profile-tagged.ttl for results.');
console.log(`\nSummary:`);
console.log(`  - Unique duplicate properties: ${duplicateCount}`);
console.log(`  - Total duplicate occurrences tagged (excluding first): ${duplicateIndices.size}`);
console.log(`\nNote: First occurrence of each property is NOT tagged (keep these).`);
console.log(`      Lines tagged with @@@ are duplicates (review/delete these).`);

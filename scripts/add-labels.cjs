#!/usr/bin/env node

/**
 * Script to add Norwegian labels to RDA properties in profile.ttl
 *
 * Usage: node add-labels.cjs
 *
 * This script:
 * 1. Loads Norwegian labels from label files (agents, works, expressions, manifestations)
 * 2. For each RDA property in profile.ttl
 * 3. Finds the Norwegian label
 * 4. Inserts "; rdfs:label "label"@no" before the period
 * 5. Writes the result to profile-with-labels.ttl
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'profile.ttl');
const outputFile = path.join(__dirname, 'profile-with-labels.ttl');

const labelFiles = [
  'labels.agents.no.ttl',
  'labels.works.no.ttl',
  'labels.expressions.no.ttl',
  'labels.manifestations.no.ttl',
];

// Map URI paths to prefixes
const uriToPrefix = {
  '/a/datatype/': 'rdaad:',
  '/a/object/': 'rdaao:',
  '/w/datatype/': 'rdawd:',
  '/w/object/': 'rdawo:',
  '/e/datatype/': 'rdaed:',
  '/e/object/': 'rdaeo:',
  '/m/datatype/': 'rdamd:',
  '/m/object/': 'rdamo:',
};

console.log('Loading Norwegian labels from label files...');
const labels = new Map();

// Load labels from all files
labelFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  Warning: ${file} not found, skipping...`);
    return;
  }

  console.log(`  Loading ${file}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const currentSize = labels.size;

  lines.forEach(line => {
    // Parse: <http://...> <http://.../rdf-schema#label> "label text"@no .
    const match = line.match(/<([^>]+)>.*<.*rdf-schema#label>.*"([^"]+)"@no/);
    if (match) {
      const uri = match[1];
      const label = match[2];

      // Convert URI to prefixed form
      for (const [path, prefix] of Object.entries(uriToPrefix)) {
        if (uri.includes(path)) {
          const propId = uri.split('/').pop();
          const prefixedUri = prefix + propId;
          labels.set(prefixedUri, label);
          break;
        }
      }
    }
  });

  console.log(`    Loaded ${labels.size - currentSize} labels from ${file}`);
});

console.log(`Loaded ${labels.size} labels`);

// Read profile.ttl
console.log('\nReading profile.ttl...');
const profileContent = fs.readFileSync(inputFile, 'utf8');
const profileLines = profileContent.split('\n');

console.log(`Total lines: ${profileLines.length}`);

// Process each line
console.log('\nProcessing lines and adding labels...');
let addedCount = 0;
let notFoundCount = 0;
const notFound = [];

const outputLines = profileLines.map((line, index) => {
  const trimmed = line.trim();

  // Skip empty lines and prefix declarations
  if (!trimmed || trimmed.startsWith('@')) {
    return line;
  }

  // Detect if line is commented out
  const isCommented = trimmed.startsWith('#');
  const lineToProcess = isCommented ? trimmed.substring(1).trim() : trimmed;

  // Extract property URI (first token)
  const match = lineToProcess.match(/^(rda[aewm][admo]:[PS]\d+)/);
  if (!match) {
    return line;
  }

  const propertyUri = match[1];
  const label = labels.get(propertyUri);

  if (!label) {
    notFoundCount++;
    if (notFound.length < 10) {
      notFound.push(propertyUri);
    }
    return line;
  }

  // Check if label already exists
  if (line.includes('rdfs:label')) {
    return line;
  }

  // Replace ` .` with ` ; rdfs:label "label"@no .`
  const labelInsert = ` ; rdfs:label "${label}"@no`;

  // For commented lines, we need to preserve the leading #
  const workingLine = isCommented ? line.substring(line.indexOf('#') + 1) : line;
  const leadingComment = isCommented ? line.substring(0, line.indexOf('#') + 1) : '';

  // Find the position of the period (before any inline comment after the property)
  const inlineCommentIndex = workingLine.indexOf('#');
  if (inlineCommentIndex !== -1) {
    // There's an inline comment after the property
    const beforeComment = workingLine.substring(0, inlineCommentIndex);
    const comment = workingLine.substring(inlineCommentIndex);

    // Replace the last . before the comment
    const periodIndex = beforeComment.lastIndexOf('.');
    if (periodIndex !== -1) {
      const result =
        leadingComment +
        beforeComment.substring(0, periodIndex).trim() +
        labelInsert + ' . ' +
        comment;
      addedCount++;
      return result;
    }
  } else {
    // No inline comment, just replace the last .
    const periodIndex = workingLine.lastIndexOf('.');
    if (periodIndex !== -1) {
      const result =
        leadingComment +
        workingLine.substring(0, periodIndex).trim() +
        labelInsert + ' .';
      addedCount++;
      return result;
    }
  }

  return line;
});

// Write output
console.log(`\nWriting to ${outputFile}...`);
fs.writeFileSync(outputFile, outputLines.join('\n'), 'utf8');

console.log('\nDone!');
console.log(`\nSummary:`);
console.log(`  - Labels added: ${addedCount}`);
console.log(`  - Labels not found: ${notFoundCount}`);
if (notFound.length > 0) {
  console.log(`\n  First missing labels:`);
  notFound.forEach(uri => console.log(`    - ${uri}`));
}

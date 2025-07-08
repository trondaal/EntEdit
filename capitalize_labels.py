#!/usr/bin/env python3

import re
import sys

def capitalize_labels(content):
    """Capitalize the first letter of RDF labels while preserving the rest."""
    
    def replace_label(match):
        # Extract the label content (everything between quotes)
        full_match = match.group(0)
        quote_pos = full_match.find('"')
        before_quote = full_match[:quote_pos + 1]  # Everything up to and including the opening quote
        after_quote = full_match[quote_pos + 1:]   # Everything after the opening quote
        
        # Find the closing quote and language tag
        closing_quote_pos = after_quote.find('"')
        if closing_quote_pos == -1:
            return full_match  # No closing quote found, return unchanged
            
        label_content = after_quote[:closing_quote_pos]
        after_label = after_quote[closing_quote_pos:]
        
        # Capitalize first letter if it's lowercase
        if label_content and label_content[0].islower():
            capitalized_label = label_content[0].upper() + label_content[1:]
        else:
            capitalized_label = label_content
            
        return before_quote + capitalized_label + after_label
    
    # Pattern to match rdfs:label lines with quoted strings
    pattern = r'<http://www\.w3\.org/2000/01/rdf-schema#label>\s+"[^"]*"@[a-z]{2}'
    
    return re.sub(pattern, replace_label, content)

def main():
    filename = "types other/labels.rda.values.ttl"
    
    # Read the file
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Capitalize labels
    new_content = capitalize_labels(content)
    
    # Write back to file
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Successfully capitalized labels in", filename)

if __name__ == "__main__":
    main()
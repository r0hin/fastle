#!/usr/bin/env fish

# Metadata tags for Raycast
# @raycast.schemaVersion 1
# @raycast.title Fastle
# @raycast.mode fullOutput
# @raycast.icon 🎯
# @raycast.packageName Fastle

# @raycast.description Find possible Wordle words based on your constraints
# @raycast.author Rohin
# @raycast.authorURL https://github.com/r0hin

# @raycast.argument1 { "type": "text", "placeholder": "Known", "optional": false }
# @raycast.argument2 { "type": "text", "placeholder": "Excluded", "optional": true }
# @raycast.argument3 { "type": "text", "placeholder": "Included", "optional": true }

# Set up environment
cd "$(dirname "$0")"

# Check if bun is installed
function does_command_exist
    type -q $argv[1]
end

if not does_command_exist bun
    echo "Error: bun not found. Install with 'curl -fsSL https://bun.sh/install | bash'"
    exit 1
end

# Get arguments from Raycast
set KNOWN_POSITIONS $argv[1]
set EXCLUDED_LETTERS $argv[2]
set INCLUDED_LETTERS $argv[3]

# Validate known positions
if test (string length $KNOWN_POSITIONS) -ne 5
    echo "❌ Known positions must be exactly 5 characters long"
    echo "Use format like 'axxbx' where 'x' means unknown position"
    exit 1
end

# Don't show any constraint information

# Run the solver quietly
set OUTPUT (bun run index.ts --known $KNOWN_POSITIONS --excluded $EXCLUDED_LETTERS --included $INCLUDED_LETTERS 2>&1)

# Don't display the raw output, we'll format it nicely
# Check for errors
if string match -q "*Error*" "$OUTPUT"
    echo "❌ Something went wrong. Please check your inputs."
    exit 1
elif string match -q "*No matching words found*" "$OUTPUT"
    echo "😕 No matching words found."
else 
    # Extract and display only the word list, one per line, alphabetically sorted
    echo "$OUTPUT" | grep -A 100 "Possible matching words:" | grep -o "[0-9]\+\. [a-z]\+" | sed -E 's/^[0-9]+\. //g' | sort
end

exit 0

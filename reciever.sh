#!/usr/bin/env fish

# Metadata tags for Raycast
# @raycast.schemaVersion 1
# @raycast.title Fastle Receiver
# @raycast.mode inline
# @raycast.icon 📲
# @raycast.packageName Fastle

# @raycast.description Find possible Wordle words based on your constraints
# @raycast.author Rohin
# @raycast.authorURL https://github.com/r0hin


# Load venv and run Python script as a subprocess
set -l venv_path "/Users/rohin/GitHub/wordle-one/venv/bin/activate.fish"
set -l script_path "/Users/rohin/GitHub/wordle-one/reciever.py"

# Create a subprocess that sources the venv and runs the Python script in the background
# Use nohup to make it completely immune to hangups and redirect output to /dev/null
nohup fish -c "source $venv_path; python3 $script_path" > /dev/null 2>&1 &

# Disown the process to fully detach it from this shell
disown

# Force immediate exit
exit 0
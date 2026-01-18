#!/bin/bash
# ZenB Desktop App Launcher
# Workaround for WebKitGTK issues on Wayland/Linux

# Force X11 backend and software rendering
export GDK_BACKEND=x11
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LIBGL_ALWAYS_SOFTWARE=1

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the app
exec "$SCRIPT_DIR/src-tauri/target/debug/app" "$@"

import threading
import socket
import signal
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os
import sys
import time

# Import PyObjC components with error checking
try:
    from objc import super
    import Cocoa
    import Foundation
    import AppKit

    OBJC_AVAILABLE = True
except ImportError:
    print("Error: PyObjC components not available")
    OBJC_AVAILABLE = False

# Global variables
current_text = "READY"
text_lock = threading.Lock()
_text_window = None  # Direct reference to text window
shutdown_flag = threading.Event()
_TextOverlay = None  # Will hold our TextOverlay class once initialized


def initialize_text_overlay_class():
    """Initialize the TextOverlay class only when PyObjC is available"""
    global _TextOverlay

    if _TextOverlay is not None:
        return _TextOverlay

    if not OBJC_AVAILABLE:
        return None

    # Define the TextOverlay class when needed
    class TextOverlay(AppKit.NSWindow):
        """A transparent window that displays centered, large text"""

        def initWithText_(self, text):
            # Get the main screen
            screen = AppKit.NSScreen.mainScreen()
            if not screen:
                return None

            # Set up window in the center of the screen
            width = screen.frame().size.width
            height = screen.frame().size.height
            window_width = width
            window_height = height
            x = 0
            y = 0
            window_rect = Foundation.NSMakeRect(x, y, window_width, window_height)

            # Create a borderless window
            self = super().initWithContentRect_styleMask_backing_defer_(
                window_rect,
                AppKit.NSWindowStyleMaskBorderless,
                AppKit.NSBackingStoreBuffered,
                False,
            )

            if not self:
                return None

            # Make it transparent
            self.setBackgroundColor_(AppKit.NSColor.clearColor())
            self.setAlphaValue_(0.5)  # 50% opacity
            self.setOpaque_(False)

            # Make it float above everything, including menu bar
            self.setLevel_(AppKit.NSStatusWindowLevel + 2)

            # Make sure it's visible everywhere
            self.setCollectionBehavior_(
                AppKit.NSWindowCollectionBehaviorCanJoinAllSpaces
            )

            # Create a single centered text field
            text_field_width = min(window_width * 0.9, 2000)
            text_field_height = 200  # Large height for big font
            text_field_x = (window_width - text_field_width) / 2
            text_field_y = (
                window_height * 0.1
            )  # Position at 10% from the top of the screen
            text_field = AppKit.NSTextField.alloc().initWithFrame_(
                Foundation.NSMakeRect(
                    text_field_x, text_field_y, text_field_width, text_field_height
                )
            )

            # Configure text appearance
            text_field.setStringValue_(text)
            text_field.setDrawsBackground_(False)
            text_field.setBezeled_(False)
            text_field.setEditable_(False)
            text_field.setSelectable_(False)
            text_field.setFont_(AppKit.NSFont.systemFontOfSize_(120))  # Very large font
            text_field.setTextColor_(AppKit.NSColor.whiteColor())
            text_field.setAlignment_(AppKit.NSTextAlignmentCenter)

            # Add to window
            self.contentView().addSubview_(text_field)

            # Store reference to the text field
            self.text_field = text_field

            # Show window
            self.orderFrontRegardless()
            return self

    # Store the class for reuse
    _TextOverlay = TextOverlay
    return TextOverlay


def create_text_window(initial_text="READY"):
    """Create the floating text window that will display the text"""
    # Skip if PyObjC isn't available
    if not OBJC_AVAILABLE:
        print("Cannot create window: PyObjC not available")
        return None

    # Get the TextOverlay class
    TextOverlay = initialize_text_overlay_class()
    if not TextOverlay:
        print("Cannot create TextOverlay class: PyObjC not properly initialized")
        return None

    try:
        # Close existing window if it exists to prevent resource leaks
        global _text_window
        if _text_window is not None:
            try:
                _text_window.close()
            except Exception as e:
                print(f"Error closing existing window: {e}")

        # Create the window
        window = TextOverlay.alloc().initWithText_(initial_text)
        if window:
            print(f"Created text overlay with initial text: '{initial_text}'")
            # Ensure window is displayed and comes to front
            window.orderFrontRegardless()
            return window
        else:
            print("Failed to create window object")
            return None
    except Exception as e:
        print(f"Exception creating text window: {e}")
        return None


def update_text_overlay(text):
    """Update the text in the floating overlay window by creating a new one"""
    global _text_window

    if not OBJC_AVAILABLE:
        print(f"Cannot update text: PyObjC not available")
        return

    max_retries = 3
    retry_count = 0
    success = False

    while retry_count < max_retries and not success:
        if _text_window is not None and hasattr(_text_window, "text_field"):
            # Try to update existing window with new text
            try:
                print(f"Updating existing window text to: '{text}'")
                _text_window.text_field.setStringValue_(text)
                _text_window.orderFrontRegardless()
                success = True
                return
            except Exception as e:
                print(f"Error updating existing window (attempt {retry_count+1}): {e}")
                retry_count += 1
                # Force create a new window on the next attempt
                _text_window = None
        else:
            # Create a new window as a fallback
            print(f"Creating new text window with: '{text}'")
            try:
                new_window = create_text_window(text)
                if new_window is not None:
                    _text_window = new_window
                    success = True
                    print(f"Text window updated to: '{text}'")
                    return
                else:
                    print("Failed to create new window")
                    retry_count += 1
            except Exception as e:
                print(f"Error creating new window (attempt {retry_count+1}): {e}")
                retry_count += 1

    if not success:
        print("Failed to update text overlay after multiple attempts")


class RequestHandler(BaseHTTPRequestHandler):
    """HTTP handler for the /draw endpoint"""

    def _set_cors_headers(self):
        """Helper method to set CORS headers"""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        global current_text

        # Parse the URL
        parsed_url = urlparse(self.path)

        # Check if this is the /draw endpoint
        if parsed_url.path == "/draw":
            # Parse the query parameters
            query_params = parse_qs(parsed_url.query)

            # Get the text parameter
            text = query_params.get("text", [""])[0]

            print(f"Received text: {text}")

            # Update the current text
            with text_lock:
                current_text = text

            # Update the text display directly
            if OBJC_AVAILABLE:
                # Make sure UI updates happen on the main thread
                # Create a separate block to capture the current text value
                text_to_update = str(text)  # Create a copy of the text

                def update_block():
                    try:
                        update_text_overlay(text_to_update)
                    except Exception as e:
                        print(f"Error in update operation: {e}")

                Foundation.NSOperationQueue.mainQueue().addOperationWithBlock_(
                    update_block
                )
                print(f"Text update dispatched for: '{text}'")
            else:
                print("Cannot update UI: PyObjC not available")

            # Send a 200 OK response
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(b"Text updated")
        else:
            # Send a 404 Not Found response
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(b"Not found")

    def log_message(self, format, *args):
        # Suppress log messages
        pass


class BasicAppDelegate(AppKit.NSObject):
    """Minimal app delegate just for handling application lifecycle"""

    def init(self):
        self = super().init()
        return self

    def applicationDidFinishLaunching_(self, notification):
        # Create the text overlay with the initial text
        global _text_window, current_text

        with text_lock:
            text = current_text

        # Create the text window
        _text_window = create_text_window(text)

        # Setup keyboard monitoring for quit
        self.setupKeyboardMonitoring()

        print("Application initialized with text overlay")

    def setupKeyboardMonitoring(self):
        # Set up keyboard event monitoring
        event_mask = AppKit.NSEventMaskKeyDown
        self.key_monitor = (
            AppKit.NSEvent.addGlobalMonitorForEventsMatchingMask_handler_(
                event_mask, self.handleKeyEvent_
            )
        )

    def handleKeyEvent_(self, event):
        # Check for Escape key or Ctrl+C
        if event.keyCode() == 53:  # Escape key
            self.quitApp_(None)
        elif event.keyCode() == 8 and (event.modifierFlags() & 0x40000):  # Ctrl+C
            print("\nCtrl+C detected, shutting down...")
            self.quitApp_(None)

    def applicationWillTerminate_(self, notification):
        global shutdown_flag
        print("Application will terminate, cleaning up...")
        shutdown_flag.set()

    def quitApp_(self, sender):
        print("Quitting application...")
        global shutdown_flag
        shutdown_flag.set()
        AppKit.NSApp.terminate_(None)


def run_server():
    """Run the HTTP server in a separate thread"""
    global shutdown_flag
    server = HTTPServer(("0.0.0.0", 8082), RequestHandler)
    print("\n============================================")
    print("Server started at http://localhost:8081")
    print("Use /draw?text=your_text to display text on the screen")
    print("Example: curl 'http://localhost:8080/draw?text=Hello%20World'")
    print("Test command: curl 'http://localhost:8080/draw?text=TEST'")
    print("Press Ctrl+C, Escape, or Command+Q to quit")
    print("============================================\n")

    # Set a timeout so we can check the shutdown flag periodically
    server.timeout = 0.5

    try:
        while not shutdown_flag.is_set():
            server.handle_request()
    except Exception as e:
        print(f"Server error: {e}")
    finally:
        print("Server stopped")


def signal_handler(sig, frame):
    """Handle Ctrl+C signal"""
    print("\nShutting down...")
    shutdown_flag.set()
    if OBJC_AVAILABLE:
        AppKit.NSApp.terminate_(None)


def main():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    # Set up signal handling
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Skip UI setup if PyObjC is not available
    if not OBJC_AVAILABLE:
        print("Running in headless mode (no UI available)")
        try:
            while not shutdown_flag.is_set():
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("KeyboardInterrupt caught in main")
            shutdown_flag.set()
        return

    # Set up the application
    app = AppKit.NSApplication.sharedApplication()
    app.setActivationPolicy_(AppKit.NSApplicationActivationPolicyRegular)

    # Create and set the delegate
    delegate = BasicAppDelegate.alloc().init()
    app.setDelegate_(delegate)

    # Create basic menu
    menubar = AppKit.NSMenu.alloc().init()
    app.setMainMenu_(menubar)

    # App menu
    appMenuItem = AppKit.NSMenuItem.alloc().init()
    menubar.addItem_(appMenuItem)
    appMenu = AppKit.NSMenu.alloc().init()
    appMenuItem.setSubmenu_(appMenu)

    # Quit menu item
    quitMenuItem = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
        "Quit", "terminate:", "q"
    )
    appMenu.addItem_(quitMenuItem)

    # Run the application
    AppKit.NSApp.activateIgnoringOtherApps_(True)

    print("\nTo quit the application, you can use:")
    print(" - Command+Q (standard macOS quit)")
    print(" - Ctrl+C (if event is captured)")
    print(" - Escape key")
    print(" - Or terminate the process from Activity Monitor or Terminal")

    try:
        app.run()
    except KeyboardInterrupt:
        print("KeyboardInterrupt caught in main")
        shutdown_flag.set()
        app.terminate_(None)


if __name__ == "__main__":
    main()

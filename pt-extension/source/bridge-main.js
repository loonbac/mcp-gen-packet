// BridgeBuilder - MCP-PTB Zero-Config Extension for Packet Tracer
// Auto-opens bridge window on PT load and manages WebSocket connection

// Global bridge window instance
var bridgeWindow = null;

// Main entry point - called by PT when extension loads
function main() {
    // Auto-open bridge window on load (ZERO CONFIG - works immediately)
    bridgeWindow = new BridgeWindow();
    bridgeWindow.show();
    
    // Also register the menu item for manual access (optional)
    initMenu();
}

// Initialize the extension menu item
function initMenu() {
    var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
    m_builderUuid = menu.insertItem("", "MCP-PTB Bridge");
    var menuItem = menu.getMenuItemByUuid(m_builderUuid);
    menuItem.registerEvent("onClicked", this, this.menuClicked);
}

// Cleanup on extension unload
function cleanUp() {
    if (bridgeWindow) {
        bridgeWindow.cleanUp();
        bridgeWindow = null;
    }
    // Clean up menu item
    if (typeof m_builderUuid !== 'undefined' && m_builderUuid !== "") {
        var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
        _ScriptModule.unregisterIpcEventByID("MenuItem", m_builderUuid, "onClicked", this, this.menuClicked);
        menu.removeItemUuid(m_builderUuid);
        m_builderUuid = "";
    }
}

// Menu click handler - show/hide bridge window
function menuClicked(src, args) {
    if (bridgeWindow) {
        bridgeWindow.toggle();
    }
}
// main.js - Merged PTBuilder + MCP-PTB Bridge
// Contains both the Builder Code Editor functionality AND the Bridge window

// Global instances
var builder = null;
var window = null;
var bridgeWindow = null;
var m_builderUuid = "";

// ============================================
// PTBuilder Builder Code Editor
// ============================================

function Builder() {
    this.m_builderUuid = "";
    this.errors = [];
}

Builder.prototype.init = function() {
    var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
    this.m_builderUuid = menu.insertItem("", "Builder Code Editor");
    var menuItem = menu.getMenuItemByUuid(this.m_builderUuid);
    menuItem.registerEvent("onClicked", this, this.menuClicked);
    
    m_builderUuid = this.m_builderUuid;
};

Builder.prototype.cleanUp = function() {
    if (this.m_builderUuid != "") {
        var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
        _ScriptModule.unregisterIpcEventByID("MenuItem", this.m_builderUuid, "onClicked", this, this.menuClicked);
        menu.removeItemUuid(this.m_builderUuid);
        this.m_builderUuid = "";
    }
};

Builder.prototype.menuClicked = function(src, args) {
    if (window) {
        window.show();
    }
};

// ============================================
// HTML Window for Builder Code Editor
// ============================================

function htmlWindow()
{
    var webview;
    var webviewId;
}

htmlWindow.prototype.init = function()
{
}

htmlWindow.prototype.cleanUp = function()
{
    if (this.webview) {
        this.webview.unregisterEvent("closed", this, this.windowClosed);
    }
}

htmlWindow.prototype.show = function()
{
    if (webViewManager.getWebView(this.webviewId) == null)
    {
        this.webview = webViewManager.createWebView("Builder Code Editor","this-sm:interface/index.html", 800, 500);
        this.webviewId = this.webview.getWebViewId() ;
        this.webview.registerEvent("closed", this, this.windowClosed);
        this.webview.setMinimumWidth(400);
        this.webview.setMinimumHeight(300);
    }

    this.webview.hide();
    this.webview.show();
}

htmlWindow.prototype.windowClosed = function(src, args)
{
    this.webviewId = "";
    if (this.webview) {
        this.webview.unregisterEvent("closed", this, this.windowClosed);
    }
}

// ============================================
// Bridge Window for MCP-PTB
// ============================================

function BridgeWindow() {
    this.webview = null;
    this.webviewId = null;
    this.isVisible = false;
}

BridgeWindow.prototype.show = function() {
    if (!this.webview || !this.webviewId) {
        this.webview = webViewManager.createWebView("MCP-PTB Bridge", "this-sm:bridge-index.html", 400, 300);
        this.webviewId = this.webview.getWebViewId();
        this.webview.registerEvent("closed", this, this.onClose);
        this.webview.setMinimumWidth(300);
        this.webview.setMinimumHeight(200);
        this.isVisible = true;
    } else {
        this.webview.show();
        this.isVisible = true;
    }
};

BridgeWindow.prototype.hide = function() {
    if (this.webview) {
        this.webview.hide();
        this.isVisible = false;
    }
};

BridgeWindow.prototype.toggle = function() {
    if (this.isVisible) {
        this.hide();
    } else {
        this.show();
    }
};

BridgeWindow.prototype.cleanUp = function() {
    if (this.webview) {
        this.webview.unregisterEvent("closed", this, this.onClose);
        this.webview = null;
        this.webviewId = null;
        this.isVisible = false;
    }
};

BridgeWindow.prototype.onClose = function(src, args) {
    this.webviewId = "";
    this.webview = null;
    this.isVisible = false;
};

// ============================================
// Main Entry Point
// ============================================

function main() {
    // Initialize PTBuilder Builder
    builder = new Builder();
    builder.init();
    
    // Initialize Builder window
    window = new htmlWindow();
    
    // Initialize Bridge window (AUTO-OPEN - Zero Config!)
    bridgeWindow = new BridgeWindow();
    bridgeWindow.show();
    
    // Register bridge menu item
    initBridgeMenu();
}

function initBridgeMenu() {
    var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
    var bridgeMenuUuid = menu.insertItem("", "MCP-PTB Bridge");
    var menuItem = menu.getMenuItemByUuid(bridgeMenuUuid);
    menuItem.registerEvent("onClicked", null, function(src, args) {
        if (bridgeWindow) {
            bridgeWindow.toggle();
        }
    });
}

function bridgeMenuClicked(src, args) {
    if (bridgeWindow) {
        bridgeWindow.toggle();
    }
}

function cleanUp() {
    // Clean up Builder
    if (builder) {
        builder.cleanUp();
        builder = null;
    }
    
    // Clean up Builder window
    if (window) {
        window.cleanUp();
        window = null;
    }
    
    // Clean up Bridge window
    if (bridgeWindow) {
        bridgeWindow.cleanUp();
        bridgeWindow = null;
    }
    
    // Clean up bridge menu item
    if (typeof m_builderUuid !== 'undefined' && m_builderUuid !== "") {
        var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
        _ScriptModule.unregisterIpcEventByID("MenuItem", m_builderUuid, "onClicked", null, function(src, args) {
            if (bridgeWindow) {
                bridgeWindow.toggle();
            }
        });
        menu.removeItemUuid(m_builderUuid);
        m_builderUuid = "";
    }
}
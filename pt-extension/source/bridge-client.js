/**
 * bridge-client.js
 * WebSocket client that auto-connects to MCP server at localhost:9090
 * and executes PTBuilder commands via $se('runCode', jsCode)
 */
(function() {
    var ws = null;
    var statusEl = document.getElementById("connStatus");
    var logEl = document.getElementById("log");
    var reconnectTimeout = null;
    var isConnected = false;

    function log(msg, type) {
        var div = document.createElement("div");
        div.className = "log-entry";
        var time = new Date().toLocaleTimeString();
        var typeClass = type || "info";
        div.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="log-' + typeClass + '">' + escapeHtml(msg) + '</span>';
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    function escapeHtml(text) {
        var div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function setStatus(text, type) {
        statusEl.textContent = text;
        statusEl.className = "status " + (type || "");
    }

    function connect() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        log("Connecting to ws://localhost:9090...", "info");
        setStatus("Connecting...", "warn");

        try {
            ws = new WebSocket("ws://localhost:9090");
        } catch(e) {
            log("WebSocket creation failed: " + e, "err");
            scheduleReconnect();
            return;
        }

        ws.onopen = function() {
            isConnected = true;
            log("Connected to MCP server", "ok");
            setStatus("Connected to MCP server", "ok");
            
            // Send handshake/identification
            try {
                ws.send(JSON.stringify({
                    type: "bridge-connect",
                    name: "MCP-PTB",
                    version: "1.0.0"
                }));
            } catch(e) {
                // Ignore send errors during handshake
            }
        };

        ws.onmessage = function(event) {
            try {
                var request = JSON.parse(event.data);
                log("Received: " + request.method, "info");
                
                // Handle different message types
                if (request.type === "ping") {
                    ws.send(JSON.stringify({ type: "pong" }));
                    return;
                }
                
                if (request.method) {
                    executeCommand(request);
                }
            } catch(e) {
                log("Parse error: " + e, "err");
            }
        };

        ws.onclose = function() {
            isConnected = false;
            log("Disconnected, reconnecting in 3s...", "err");
            setStatus("Disconnected — reconnecting in 3s...", "err");
            scheduleReconnect();
        };

        ws.onerror = function(error) {
            log("WebSocket error occurred", "err");
            // Error is followed by close, so reconnect is handled there
        };
    }

    function scheduleReconnect() {
        if (reconnectTimeout) return;
        reconnectTimeout = setTimeout(function() {
            reconnectTimeout = null;
            connect();
        }, 3000);
    }

    function executeCommand(request) {
        var method = request.method;
        var params = request.params || {};
        var id = request.id;

        log("Executing: " + method, "info");
        
        try {
            // Build PTBuilder JavaScript code from MCP method
            var code = buildCode(method, params);
            log("Code: " + code.substring(0, 80) + (code.length > 80 ? "..." : ""), "info");
            
            // Execute via PTBuilder's runCode function
            var result = $se("runCode", code);
            
            log("Success: " + method, "ok");
            
            // Send success response
            sendResponse(id, {
                success: true,
                result: {
                    executed: true,
                    method: method,
                    code: code
                }
            });
        } catch(e) {
            log("Error executing " + method + ": " + e, "err");
            sendResponse(id, {
                success: false,
                error: {
                    code: -1,
                    message: String(e)
                }
            });
        }
    }

    function sendResponse(id, response) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                response.id = id;
                ws.send(JSON.stringify(response));
            } catch(e) {
                log("Failed to send response: " + e, "err");
            }
        }
    }

    /**
     * Map MCP method to PTBuilder JavaScript code
     * These functions are defined in userfunctions.js
     */
    function buildCode(method, params) {
        switch(method) {
            case "add_device":
                return "addDevice(" + 
                    JSON.stringify(params.name) + "," + 
                    JSON.stringify(params.model) + "," + 
                    (params.x !== undefined ? params.x : 100) + "," + 
                    (params.y !== undefined ? params.y : 100) + ")";

            case "add_link":
                return "addLink(" + 
                    JSON.stringify(params.device1) + "," + 
                    JSON.stringify(params.interface1) + "," + 
                    JSON.stringify(params.device2) + "," + 
                    JSON.stringify(params.interface2) + "," + 
                    JSON.stringify(params.type || "straight") + ")";

            case "add_module":
                return "addModule(" + 
                    JSON.stringify(params.device) + "," + 
                    params.slot + "," + 
                    JSON.stringify(params.model) + ")";

            case "configure_pc_ip":
                return "configurePcIp(" + 
                    JSON.stringify(params.device) + "," + 
                    (params.dhcp !== undefined ? params.dhcp : false) + "," + 
                    JSON.stringify(params.ip || "") + "," + 
                    JSON.stringify(params.subnetMask || "") + "," + 
                    JSON.stringify(params.gateway || "") + "," + 
                    JSON.stringify(params.dnsServer || "") + ")";

            case "configure_ios_device":
                return "configureIosDevice(" + 
                    JSON.stringify(params.device) + "," + 
                    JSON.stringify(params.commands) + ")";

            case "get_devices":
                // getDevices returns an array, send back via WebSocket
                var devices = getDevices(params.filter, params.startsWith);
                sendResponse(null, {
                    success: true,
                    result: {
                        devices: devices
                    }
                });
                return "getDevices()";

            case "delete_device":
                return "deleteDevice(" + JSON.stringify(params.name) + ")";

            case "power_on_device":
                return "powerOnDevice(" + JSON.stringify(params.name) + ")";

            case "power_off_device":
                return "powerOffDevice(" + JSON.stringify(params.name) + ")";

            case "get_device_info":
                return "getDeviceInfo(" + JSON.stringify(params.name) + ")";

            default:
                log("Unknown method: " + method, "warn");
                return "// Unknown method: " + method;
        }
    }

    // Expose getDevices to bridge scope so it can be called from buildCode
    // This is defined in userfunctions.js which is loaded before this file

    // Auto-connect on load
    log("Initializing MCP-PTB Bridge...", "info");
    connect();
})();
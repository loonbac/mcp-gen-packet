function runCode(scriptText) {
    try {
        const codeFunction = new Function(scriptText);
        try {
            codeFunction();
            return true;
        } catch (error) {
            console.log(error);
            ipc.appWindow().showMessageBox("Builder" + " ".repeat(100), "An error occurred on line " + error.lineNumber + ":", error, 3, 0x00000400, 0x00000400, 0x00000400)
            return false;
        }
    } catch (error) {
        console.log(error);
        ipc.appWindow().showMessageBox("Builder" + " ".repeat(100), "An error occurred:", error, 3, 0x00000400, 0x00000400, 0x00000400)
    }
}

// MCP-PTB result channel: evaluates an expression in the PT engine and
// returns its value to the bridge webview via $se('evalExpr', expr).
// The bridge pump reads __mcpLastResult through this and POSTs the
// BridgeResult envelope to POST /result (see bridge.html).
function evalExpr(exprText) {
    try {
        return new Function("return (" + exprText + ")")();
    } catch (error) {
        return undefined;
    }
}
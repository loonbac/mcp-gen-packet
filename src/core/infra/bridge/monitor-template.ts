/**
 * Pure template function that generates the retro Win32 monitor dashboard HTML page.
 * Free of Node.js HTTP, file system, or mutable state dependencies.
 */
export function getMonitorHtml(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bridge Monitor</title>
    <style>
      body { margin: 0; padding: 20px; background-color: #008080; font-family: 'Tahoma', 'Verdana', sans-serif; color: #000; }
      .window { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; padding: 2px; max-width: 900px; margin: 0 auto; }
      .title-bar { background: #000080; color: #fff; padding: 2px 4px 2px 6px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 13px; }
      .title-controls { display: flex; gap: 2px; }
      .title-btn { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; width: 16px; height: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: default; }
      .window-body { padding: 8px; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
      .sunken { background: #fff; border: 2px solid; border-top-color: #808080; border-left-color: #808080; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #000, inset -1px 1px #fff, -1px 1px #dfdfdf, 1px 1px #808080; }
      .card { padding: 4px 6px; display: flex; justify-content: space-between; align-items: center; }
      .k { font-size: 11px; color: #000; text-transform: capitalize; }
      .v { font-size: 12px; font-weight: bold; font-family: 'Courier New', monospace; color: #000; }
      .ok { color: #008000 !important; }
      .bad { color: #ff0000 !important; }
      .panel { padding: 6px; margin-bottom: 10px; }
      .panel-title { font-size: 11px; margin-bottom: 4px; font-weight: bold; }
      .flow { font-family: 'Courier New', monospace; font-size: 12px; padding: 4px; }
      .flow b { color: #000; border-bottom: 1px dotted #808080; }
      .flow .arrow { color: #000080; }
      .table-container { background: #fff; max-height: 180px; overflow-y: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Courier New', monospace; }
      th { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; padding: 4px; text-align: left; position: sticky; top: 0; }
      td { padding: 2px 4px; border-bottom: 1px dotted #c0c0c0; }
      tr.row-fail td { color: #ff0000; font-weight: bold; }
      tr.row-warn td { color: #808000; font-weight: bold; }
      tr.row-ok td { color: #000; }
      .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
      .pager-info { font-size: 11px; }
      .pager-btns { display: flex; gap: 4px; }
      .pager-btns button { background: #c0c0c0; border: 2px solid; border-top-color: #dfdfdf; border-left-color: #dfdfdf; border-bottom-color: #000; border-right-color: #000; box-shadow: inset 1px 1px #fff, inset -1px 1px #808080; font-family: 'Tahoma', sans-serif; font-size: 11px; padding: 2px 8px; cursor: pointer; }
      .pager-btns button:active:not(:disabled) { border-top-color: #000; border-left-color: #000; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #808080, inset -1px 1px #fff; padding: 3px 7px 1px 9px; }
      .pager-btns button:disabled { color: #808080; text-shadow: 1px 1px #fff; }
      .status-bar { display: flex; gap: 2px; margin-top: 8px; }
      .status-pane { padding: 2px 4px; font-size: 11px; border: 2px solid; border-top-color: #808080; border-left-color: #808080; border-bottom-color: #dfdfdf; border-right-color: #dfdfdf; box-shadow: inset 1px 1px #000, inset -1px 1px #fff; flex: 1; }
    </style>
  </head>
  <body>
    <div class="window">
      <div class="title-bar"><span>Bridge Monitor</span><div class="title-controls"><div class="title-btn" style="line-height:8px">_</div><div class="title-btn" style="font-size:14px;line-height:14px;padding-bottom:2px">□</div><div class="title-btn" style="font-weight:900">X</div></div></div>
      <div class="window-body">
        <div class="grid">
          <div class="card sunken"><div class="k">Running</div><div id="running" class="v">-</div></div>
          <div class="card sunken"><div class="k">Connected</div><div id="connected" class="v">-</div></div>
          <div class="card sunken"><div class="k">Polling</div><div id="pollingActive" class="v">-</div></div>
          <div class="card sunken"><div class="k">PT Node</div><div id="packetTracerRunning" class="v">-</div></div>
          <div class="card sunken"><div class="k">Last Evnt</div><div id="lastEvent" class="v">-</div></div>
          <div class="card sunken"><div class="k">Queue</div><div id="queueDepth" class="v">-</div></div>
          <div class="card sunken"><div class="k">Polls</div><div id="polls" class="v">-</div></div>
          <div class="card sunken"><div class="k">Total Q'd</div><div id="queued" class="v">-</div></div>
          <div class="card sunken"><div class="k">Results</div><div id="results" class="v">-</div></div>
          <div class="card sunken"><div class="k">Last Poll</div><div id="lastPollAgo" class="v">-</div></div>
        </div>
        <div class="panel-title">Transport Pipeline</div>
        <div class="panel sunken"><div class="flow"><b>Gemini/Tools</b> <span class="arrow">--></span> <b>MCP Server</b> <span class="arrow">--></span> <b>HTTP /queue</b> <span class="arrow">--></span> <b>Bridge /next</b> <span class="arrow">--></span> <b>BridgeBuilder $se('runCode')</b> <span class="arrow">--></span> <b>Engine</b></div></div>
        <div class="panel-title">Event Log</div>
        <div class="table-container sunken"><table><thead><tr><th>Timestamp</th><th>Kind</th><th>Detail</th></tr></thead><tbody id="events"></tbody></table></div>
        <div class="pager"><div class="pager-info" id="pagerInfo">Page -- of --</div><div class="pager-btns"><button id="btnFirst" onclick="goPage(0)">&lt;&lt;</button><button id="btnPrev" onclick="goPage(currentPage-1)">&lt;</button><button id="btnNext" onclick="goPage(currentPage+1)">&gt;</button><button id="btnLast" onclick="goPage(totalPages-1)">&gt;&gt;</button></div></div>
        <div class="status-bar"><div class="status-pane" id="clock">--:--:--</div><div class="status-pane">Port: 54321</div><div class="status-pane" id="bridgeHealth">Ready</div></div>
      </div>
    </div>
    <script>
      function updateClock(){const n=new Date(),p=s=>String(s).padStart(2,'0');document.getElementById('clock').textContent=p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds())}updateClock();setInterval(updateClock,1000);
      const PAGE_SIZE=12;let allEvents=[];let currentPage=0;let totalPages=1;let autoSlide=true;
      function setText(id,value,cls){const el=document.getElementById(id);if(el){el.textContent=String(value);el.className='v '+(cls||'');}}
      function esc(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
      function eventClass(kind,detail){const s=(String(kind)+' '+String(detail)).toLowerCase();if(s.includes('error')||s.includes('fail')||s.includes('timeout')||s.includes('fallback')||s.includes('port-in-use'))return 'row-fail';if(s.includes('warning')||s.includes('warn')||s.includes('idle'))return 'row-warn';return 'row-ok'}
      function renderPage(){const start=currentPage*PAGE_SIZE;const page=allEvents.slice(start,start+PAGE_SIZE);const rows=page.map(ev=>'<tr class="'+eventClass(ev.kind,ev.detail)+'"><td>'+esc(ev.ts)+'</td><td>'+esc(ev.kind)+'</td><td>'+esc(ev.detail)+'</td></tr>').join('');document.getElementById('events').innerHTML=rows;document.getElementById('pagerInfo').textContent='Page '+(currentPage+1)+' of '+totalPages;document.getElementById('btnFirst').disabled=currentPage===0;document.getElementById('btnPrev').disabled=currentPage===0;document.getElementById('btnNext').disabled=currentPage>=totalPages-1;document.getElementById('btnLast').disabled=currentPage>=totalPages-1;if(autoSlide){const container=document.querySelector('.table-container');if(container){container.scrollTop=container.scrollHeight;}}}
      function goPage(p){currentPage=Math.max(0,Math.min(p,totalPages-1));renderPage()}
      async function tick(){try{const sR=await fetch('/status',{cache:'no-store'});const s=await sR.json();setText('running',s.running,s.running?'ok':'bad');setText('connected',s.connected,s.connected?'ok':'bad');setText('pollingActive',s.polling_active,s.polling_active?'ok':'bad');setText('packetTracerRunning',s.packet_tracer_running,s.packet_tracer_running?'ok':'bad');setText('queueDepth',s.queueDepth??'-');setText('lastEvent',s.last_event??'-');setText('polls',s.polls??0);setText('queued',s.queued??0);setText('results',s.results_received??0);setText('lastPollAgo',s.last_poll_ago!==null?Number(s.last_poll_ago).toFixed(1)+'s':'--');const health=document.getElementById('bridgeHealth');if(health){if(s.connected&&s.polling_active){health.textContent='Connected';}else if(s.running&&s.packet_tracer_running){health.textContent='Waiting Poll';}else if(s.running){health.textContent='Waiting PT';}else{health.textContent='Stopped';}}const lR=await fetch('/logs',{cache:'no-store'});const l=await lR.json();allEvents=(l.events||[]).slice(-240);totalPages=Math.max(1,Math.ceil(allEvents.length/PAGE_SIZE));if(autoSlide){currentPage=totalPages-1;}else if(currentPage>=totalPages){currentPage=totalPages-1;}renderPage()}catch(e){setText('connected','ERR','bad');const health=document.getElementById('bridgeHealth');if(health){health.textContent='Error';}}}
      tick();setInterval(tick,1000)
    </script>
  </body>
</html>`;
}

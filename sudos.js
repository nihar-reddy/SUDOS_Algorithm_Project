const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const btnAddNode = document.getElementById('add-node-btn');
const btnAddEdge = document.getElementById('add-edge-btn');
const btnSetSource = document.getElementById('set-source-btn');
const btnSetSink = document.getElementById('set-sink-btn');
const btnClear = document.getElementById('clear-btn');
const btnRun = document.getElementById('run-btn');
const btnPause = document.getElementById('pause-btn');
const btnNext = document.getElementById('next-btn');
const selectAlgo = document.getElementById('algo-select');
const speedSlider = document.getElementById('speed-slider');
const statusText = document.getElementById('status-text');
const finalResultText = document.getElementById('final-result');

// SUDOS UI Elements
const agentSlider = document.getElementById('agent-slider');
const agentCount = document.getElementById('agent-count');
const metricTime = document.getElementById('metric-time');
const metricCost = document.getElementById('metric-cost');
const metricComplexity = document.getElementById('metric-complexity');

// App State
let nodes = [];
let edges = []; // {u, v, capacity, flow, id}
let nodeIdCounter = 0;
let currentMode = 'IDLE'; 
let selectedNodeForEdge = null;
let sourceNode = null;
let targetNodes = new Set(); // MULTIPLE CUSTOMERS

// Multi-Agent Color Palette
const agentColors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#eab308']; 

// Animation State
let animationFrames = [];
let frameIdx = 0;
let animationTimer = null;
let isAnimating = false;

if (agentSlider) {
    agentSlider.addEventListener('input', (e) => {
        agentCount.innerText = e.target.value;
        updateStatus(`Agents adjusted to ${e.target.value}. Ready to route.`);
    });
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawGraph();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ==========================================
// INTERACTION & EVENTS
// ==========================================

function setMode(mode) {
    if (isAnimating) stopAnimation();
    currentMode = mode;
    selectedNodeForEdge = null;
    
    btnAddNode.classList.toggle('active', mode === 'ADD_NODE');
    btnAddEdge.classList.toggle('active', mode === 'ADD_EDGE');
    btnSetSource.classList.toggle('active', mode === 'SET_SOURCE');
    btnSetSink.classList.toggle('active', mode === 'SET_SINK');
    
    let msgs = {
        'ADD_NODE': "Click anywhere to add a delivery location.",
        'ADD_EDGE': "Click one location, then another to create a road.",
        'SET_SOURCE': "Click a location to set as the Warehouse (W).",
        'SET_SINK': "Click multiple locations to set them as Customers (C).",
        'IDLE': "Idle. Ready to run."
    };
    updateStatus(msgs[mode]);
    drawGraph();
}

btnAddNode.addEventListener('click', () => setMode('ADD_NODE'));
btnAddEdge.addEventListener('click', () => setMode('ADD_EDGE'));
btnSetSource.addEventListener('click', () => setMode('SET_SOURCE'));
btnSetSink.addEventListener('click', () => setMode('SET_SINK'));

btnClear.addEventListener('click', () => {
    stopAnimation();
    nodes = []; edges = []; nodeIdCounter = 0;
    sourceNode = null; targetNodes.clear();
    finalResultText.innerText = '';
    resetMetrics();
    setMode('IDLE');
    drawGraph();
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedNode = getHoveredNode(x, y);

    if (currentMode === 'ADD_NODE') {
        nodes.push({ id: nodeIdCounter++, x, y });
        drawGraph();
    } else if (currentMode === 'SET_SOURCE' && clickedNode) {
        sourceNode = clickedNode.id;
        if(targetNodes.has(sourceNode)) targetNodes.delete(sourceNode);
        updateStatus(`Location ${sourceNode} set as Warehouse.`);
        drawGraph();
    } else if (currentMode === 'SET_SINK' && clickedNode) {
        if (targetNodes.has(clickedNode.id)) {
            targetNodes.delete(clickedNode.id);
            updateStatus(`Location ${clickedNode.id} removed from Customers.`);
        } else {
            if(sourceNode === clickedNode.id) sourceNode = null;
            targetNodes.add(clickedNode.id);
            updateStatus(`Location ${clickedNode.id} added as a Customer.`);
        }
        drawGraph();
    } else if (currentMode === 'ADD_EDGE' && clickedNode) {
        if (!selectedNodeForEdge) {
            selectedNodeForEdge = clickedNode;
            updateStatus(`Selected Location ${clickedNode.id}. Click target location.`);
            drawGraph();
        } else if (selectedNodeForEdge !== clickedNode) {
            let weight = parseInt(prompt("Enter travel distance / capacity:", "10"));
            if (isNaN(weight) || weight < 1) weight = 1;

            let edgeId = `${selectedNodeForEdge.id}-${clickedNode.id}`;
            let existingEdge = edges.find(e => e.id === edgeId);
            
            if(existingEdge) existingEdge.capacity = weight;
            else edges.push({ u: selectedNodeForEdge.id, v: clickedNode.id, capacity: weight, flow: 0, id: edgeId });
            
            selectedNodeForEdge = null;
            updateStatus("Route added. Select another location to continue.");
            drawGraph();
        }
    }
});

function getHoveredNode(x, y) { return nodes.find(n => Math.hypot(n.x - x, n.y - y) < 20); }
function updateStatus(text) { statusText.innerText = text; }
function resetMetrics() { metricTime.innerText = '-- ms'; metricCost.innerText = '-- km'; metricComplexity.innerText = '--'; }

// ==========================================
// HIGH PRECISION TIME FORMATTER
// ==========================================
function formatTime(t0, t1) {
    let diff = t1 - t0;
    if (diff === 0) return "< 0.10 ms"; 
    if (diff < 1) return diff.toFixed(3) + " ms";
    return diff.toFixed(2) + " ms";
}

// ==========================================
// DRAWING ENGINE
// ==========================================

function drawGraph(activeNodes = new Set(), visitedNodes = new Set(), activeEdges = new Set(), visitedEdges = new Set(), currentNode = null, agentPaths = {}, edgeFlows = {}) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    edges.forEach(edge => {
        const n1 = nodes.find(n => n.id === edge.u);
        const n2 = nodes.find(n => n.id === edge.v);
        
        ctx.beginPath();
        
        if (agentPaths && agentPaths[edge.id] && agentPaths[edge.id].length > 0) {
            let agentsOnEdge = agentPaths[edge.id];
            ctx.lineWidth = 6;
            
            agentsOnEdge.forEach((agentId, index) => {
                let color = agentColors[agentId % agentColors.length];
                ctx.strokeStyle = color; ctx.fillStyle = color;
                
                if (agentsOnEdge.length > 1) {
                    ctx.setLineDash([15, 15 * (agentsOnEdge.length - 1)]);
                    ctx.lineDashOffset = -index * 15;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.setLineDash([]); 
                    ctx.shadowBlur = 10; ctx.shadowColor = color;
                }
                
                ctx.beginPath();
                ctx.moveTo(n1.x, n1.y);
                const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
                const endX = n2.x - 20 * Math.cos(angle);
                const endY = n2.y - 20 * Math.sin(angle);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            });
            
            ctx.setLineDash([]); 
            let firstColor = agentColors[agentsOnEdge[0] % agentColors.length];
            ctx.fillStyle = firstColor; ctx.strokeStyle = firstColor;
            ctx.beginPath();
            const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
            const endX = n2.x - 20 * Math.cos(angle);
            const endY = n2.y - 20 * Math.sin(angle);
            const headlen = 10;
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(endX, endY);
            ctx.fill();

        } else {
            ctx.moveTo(n1.x, n1.y);
            if (activeEdges.has(edge.id)) {
                ctx.strokeStyle = '#eab308'; ctx.fillStyle = '#eab308'; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = '#eab308';
            } else if (visitedEdges.has(edge.id)) {
                ctx.strokeStyle = '#10b981'; ctx.fillStyle = '#10b981'; ctx.lineWidth = 3; ctx.shadowBlur = 5; ctx.shadowColor = '#10b981';
            } else {
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)'; ctx.fillStyle = 'rgba(100, 116, 139, 0.6)'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
            }
            const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
            const endX = n2.x - 20 * Math.cos(angle);
            const endY = n2.y - 20 * Math.sin(angle);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            ctx.beginPath();
            const headlen = 10;
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(endX, endY);
            ctx.fill();
        }

        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        let label = edge.capacity + "km";
        if (edgeFlows[edge.id] !== undefined) label = `${edgeFlows[edge.id]}/${edge.capacity}`;
        ctx.shadowBlur = 2; ctx.shadowColor = '#000';
        ctx.fillText(label, midX, midY - 10);
        ctx.shadowBlur = 0;
    });

    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
        
        ctx.shadowBlur = 15;
        if (node.id === currentNode) {
            ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444';
        } else if (activeNodes.has(node.id)) {
            ctx.fillStyle = '#eab308'; ctx.shadowColor = '#eab308';
        } else if (visitedNodes.has(node.id)) {
            ctx.fillStyle = '#10b981'; ctx.shadowColor = '#10b981';
        } else if (node.id === sourceNode) {
            ctx.fillStyle = '#22c55e'; ctx.shadowColor = '#22c55e';
        } else if (targetNodes.has(node.id)) {
            ctx.fillStyle = '#f43f5e'; ctx.shadowColor = '#f43f5e';
        } else {
            ctx.fillStyle = '#3b82f6'; ctx.shadowColor = '#3b82f6';
        }
        
        ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '16px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
        
        let label = node.id;
        if(node.id === sourceNode) label = "W";
        if(targetNodes.has(node.id)) label = "C";
        ctx.fillText(label, node.x, node.y);
    });
}

// ==========================================
// PLAYBACK CONTROLS
// ==========================================

function stopAnimation() { clearInterval(animationTimer); animationTimer = null; isAnimating = false; }

function renderFrame(index) {
    if (index >= animationFrames.length) {
        stopAnimation();
        if(animationFrames.length > 0) updateStatus("Network Routing Complete.");
        return;
    }
    const f = animationFrames[index];
    drawGraph(f.activeNodes, f.visitedNodes, f.activeEdges, f.visitedEdges, f.currentNode, f.agentPaths, f.edgeFlows);
    updateStatus(f.status);
    if(f.finalResult) finalResultText.innerText = f.finalResult;
    
    if(f.metrics) {
        if(f.metrics.time) metricTime.innerText = f.metrics.time;
        if(f.metrics.cost !== undefined) metricCost.innerText = f.metrics.cost;
        if(f.metrics.complexity) metricComplexity.innerText = f.metrics.complexity;
    }
}

selectAlgo.addEventListener('change', () => {
    stopAnimation(); frameIdx = 0; animationFrames = []; finalResultText.innerText = '';
    resetMetrics(); drawGraph(); updateStatus("Algorithm changed. Ready to run.");
});

btnRun.addEventListener('click', () => {
    if (nodes.length === 0) return;
    if (!isAnimating && frameIdx >= animationFrames.length) frameIdx = 0;
    if (!isAnimating && frameIdx === 0) compileAlgorithm();
    if (animationTimer) return;
    isAnimating = true;
    let speed = parseInt(speedSlider.value);
    animationTimer = setInterval(() => {
        renderFrame(frameIdx); frameIdx++;
        if (frameIdx >= animationFrames.length) stopAnimation();
    }, speed);
});

btnPause.addEventListener('click', stopAnimation);
btnNext.addEventListener('click', () => {
    if (nodes.length === 0) return;
    if (!isAnimating && frameIdx >= animationFrames.length) frameIdx = 0;
    if (!isAnimating && frameIdx === 0) compileAlgorithm();
    stopAnimation();
    if (frameIdx < animationFrames.length) { renderFrame(frameIdx); frameIdx++; }
});
speedSlider.addEventListener('input', () => { if(animationTimer) { stopAnimation(); btnRun.click(); } });

// ==========================================
// ALGORITHM ENGINE
// ==========================================

function compileAlgorithm() {
    setMode('IDLE'); animationFrames = []; frameIdx = 0; finalResultText.innerText = ''; resetMetrics();
    edges.forEach(e => e.flow = 0);
    const algo = selectAlgo.value;
    const start = sourceNode !== null ? sourceNode : (nodes[0] ? nodes[0].id : null);
    
    if (start === null) { alert("Please set a Warehouse (W)."); return; }
    if (targetNodes.size === 0) { alert("Please set at least one Customer (C)."); return; }

    if (algo === 'dijkstra') runMultiAgentDispatch(start);
    else if (algo === 'floyd-warshall') runFloydWarshall(start);
    else if (algo === 'greedy') runGreedyDelivery(start);
    else if (algo === 'dp-tsp') runMultiAgentDP(start);
    else if (algo === 'heuristic-tsp') runMultiAgentHeuristic(start);
    else if (algo === 'ford-fulkerson') runFordFulkersonMulti(start);
}

function saveFrame(data) {
    animationFrames.push({
        activeNodes: new Set(data.activeNodes || []),
        visitedNodes: new Set(data.visitedNodes || []),
        activeEdges: new Set(data.activeEdges || []),
        visitedEdges: new Set(data.visitedEdges || []),
        currentNode: data.currentNode || null,
        agentPaths: data.agentPaths || {},
        edgeFlows: data.edgeFlows || {},
        status: data.status || "",
        finalResult: data.finalResult || "",
        metrics: data.metrics || null
    });
}

function getAdjList(undirected = false) {
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
        adj[e.u].push({ v: e.v, weight: e.capacity, id: e.id });
        if (undirected) adj[e.v].push({ v: e.u, weight: e.capacity, id: e.id }); 
    });
    return adj;
}

function buildPath(parentObj, start, target) {
    let curr = target; let pathEdges = [];
    while (curr !== start && parentObj[curr] !== undefined) {
        let p = parentObj[curr]; pathEdges.push(`${p}-${curr}`); curr = p;
    }
    return pathEdges.reverse();
}

function clusterTargetsForAgents(targetsArr, numAgents) {
    let assignments = Array.from({length: numAgents}, () => []);
    targetsArr.forEach((t, i) => assignments[i % numAgents].push(t));
    return assignments;
}

// ==========================================
// 1. FLOYD-WARSHALL (All-Pairs Shortest Path)
// ==========================================
function runFloydWarshall(startNode) {
    const t0 = performance.now();
    let dist = {}; let next = {};
    
    nodes.forEach(u => {
        dist[u.id] = {}; next[u.id] = {};
        nodes.forEach(v => {
            dist[u.id][v.id] = (u.id === v.id) ? 0 : Infinity;
            next[u.id][v.id] = null;
        });
    });
    edges.forEach(e => {
        dist[e.u][e.v] = e.capacity; next[e.u][e.v] = e.v;
        dist[e.v][e.u] = e.capacity; next[e.v][e.u] = e.u; 
    });

    saveFrame({ status: "Computing APSP Matrix (Floyd-Warshall)...", metrics: { complexity: "O(V³)" } });

    nodes.forEach(k => {
        nodes.forEach(i => {
            nodes.forEach(j => {
                if (dist[i.id][k.id] !== Infinity && dist[k.id][j.id] !== Infinity &&
                    dist[i.id][k.id] + dist[k.id][j.id] < dist[i.id][j.id]) {
                    dist[i.id][j.id] = dist[i.id][k.id] + dist[k.id][j.id];
                    next[i.id][j.id] = next[i.id][k.id];
                }
            });
        });
    });

    let totalAgents = parseInt(agentSlider.value, 10);
    let targets = Array.from(targetNodes);
    let agentAssignments = clusterTargetsForAgents(targets, totalAgents);
    
    let globalAgentPaths = {}; 
    let totalCost = 0;

    for (let a = 0; a < totalAgents; a++) {
        let currentLoc = startNode;
        agentAssignments[a].forEach(target => {
            if (dist[currentLoc][target] !== Infinity) {
                totalCost += dist[currentLoc][target];
                let u = currentLoc;
                while (u !== target) {
                    let v = next[u][target];
                    let edgeId1 = `${u}-${v}`; let edgeId2 = `${v}-${u}`;
                    let eId = edges.find(e => e.id === edgeId1 || e.id === edgeId2)?.id;
                    if(eId) {
                        if (!globalAgentPaths[eId]) globalAgentPaths[eId] = [];
                        if (!globalAgentPaths[eId].includes(a)) globalAgentPaths[eId].push(a);
                    }
                    u = v;
                }
                currentLoc = target; 
            }
        });
    }

    const t1 = performance.now();
    saveFrame({
        agentPaths: globalAgentPaths,
        status: `Floyd-Warshall Complete. Routes optimized for ${Math.min(totalAgents, targets.length)} Agents.`,
        finalResult: `Total Fleet Distance: ${totalCost}km`,
        metrics: { time: formatTime(t0, t1), cost: totalCost + " km", complexity: "O(V³)" }
    });
}

// ==========================================
// 2. MULTI-AGENT VRP DISPATCH (Dijkstra adaptation)
// ==========================================
function runMultiAgentDispatch(startNode) {
    const t0 = performance.now();
    let totalAgents = parseInt(agentSlider.value, 10);
    let targets = Array.from(targetNodes);
    let agentAssignments = clusterTargetsForAgents(targets, totalAgents);

    let globalAgentPaths = {}; 
    let totalCost = 0;

    function getShortestPathToAny(start, validTargets) {
        const adj = getAdjList();
        const dist = {}; const parent = {}; const visited = new Set();
        nodes.forEach(n => dist[n.id] = Infinity); dist[start] = 0;

        for (let i = 0; i < nodes.length; i++) {
            let u = -1;
            for (let n of nodes) { if (!visited.has(n.id) && (u === -1 || dist[n.id] < dist[u])) u = n.id; }
            if (dist[u] === Infinity) break;
            visited.add(u);

            if (validTargets.includes(u)) {
                return { target: u, pathEdges: buildPath(parent, start, u), cost: dist[u] };
            }

            for (let edge of adj[u]) {
                if (!visited.has(edge.v) && dist[u] + edge.weight < dist[edge.v]) {
                    dist[edge.v] = dist[u] + edge.weight; parent[edge.v] = u;
                }
            }
        }
        return null;
    }

    for (let a = 0; a < totalAgents; a++) {
        if (agentAssignments[a].length === 0) continue; 
        let currentLoc = startNode;
        let assignedTargets = agentAssignments[a];

        while(assignedTargets.length > 0) {
            let pathResult = getShortestPathToAny(currentLoc, assignedTargets);
            if (!pathResult) break; 

            pathResult.pathEdges.forEach(eId => {
                if (!globalAgentPaths[eId]) globalAgentPaths[eId] = [];
                if (!globalAgentPaths[eId].includes(a)) globalAgentPaths[eId].push(a);
            });

            totalCost += pathResult.cost;
            currentLoc = pathResult.target;
            assignedTargets = assignedTargets.filter(t => t !== currentLoc);

            saveFrame({
                agentPaths: JSON.parse(JSON.stringify(globalAgentPaths)),
                status: `Agent ${a+1} traveling to Customer ${currentLoc}...`
            });
        }
    }

    const t1 = performance.now();
    saveFrame({
        agentPaths: globalAgentPaths,
        status: `Dispatch Complete. ${Math.min(totalAgents, targets.length)} Agents successfully routed.`,
        finalResult: `Total Fleet Distance: ${totalCost}km`,
        metrics: { time: formatTime(t0, t1), cost: totalCost + " km", complexity: "O(K * E log V)" }
    });
}

// ==========================================
// 3. MULTI-AGENT HEURISTIC TSP (Fixed for Spanning Trees)
// ==========================================
function runMultiAgentHeuristic(startNode) {
    const t0 = performance.now();
    let totalAgents = parseInt(agentSlider.value, 10);
    let targets = Array.from(targetNodes);
    let agentAssignments = clusterTargetsForAgents(targets, totalAgents);
    
    let globalAgentPaths = {}; 
    let totalCost = 0;
    const adj = getAdjList(true); 

    saveFrame({status: "Building specific MST per Agent cluster...", metrics: {complexity: "O(K * E log V)"}});

    for(let a = 0; a < totalAgents; a++) {
        if (agentAssignments[a].length === 0) continue;
        
        let requiredNodes = new Set([startNode, ...agentAssignments[a]]);
        let visited = new Set([startNode]); 
        
        // Loop until all assigned targets for this agent are captured in the tree
        let allFound = false;
        while (!allFound) {
            let minEdge = null; let minWeight = Infinity;
            for (let u of visited) {
                for (let edge of adj[u]) {
                    // Find the absolute shortest edge branching off the visited tree
                    if (!visited.has(edge.v) && edge.weight < minWeight) {
                        minWeight = edge.weight; minEdge = edge;
                    }
                }
            }
            if (!minEdge) break; // Reached a dead end
            
            visited.add(minEdge.v);
            if (!globalAgentPaths[minEdge.id]) globalAgentPaths[minEdge.id] = [];
            globalAgentPaths[minEdge.id].push(a);
            totalCost += minWeight;
            
            saveFrame({agentPaths: JSON.parse(JSON.stringify(globalAgentPaths)), status: `Agent ${a+1} growing spanning tree to node ${minEdge.v}`});
            
            allFound = Array.from(requiredNodes).every(req => visited.has(req));
        }
    }

    const t1 = performance.now();
    saveFrame({ 
        agentPaths: globalAgentPaths, status: "mTSP Heuristic Complete.", finalResult: `Approx Fleet Distance: ${totalCost}km`,
        metrics: { time: formatTime(t0, t1), cost: totalCost + " km", complexity: "O(K * E log V)" }
    });
}

// ==========================================
// 4. MULTI-AGENT DP TSP (Fixed Bitmask implementation via APSP)
// ==========================================
function runMultiAgentDP(startNode) {
    const t0 = performance.now();
    
    // 1. We must first generate an APSP Matrix so the DP can jump between nodes
    let dist = {}; let next = {};
    nodes.forEach(u => {
        dist[u.id] = {}; next[u.id] = {};
        nodes.forEach(v => {
            dist[u.id][v.id] = (u.id === v.id) ? 0 : Infinity;
            next[u.id][v.id] = null;
        });
    });
    edges.forEach(e => {
        dist[e.u][e.v] = e.capacity; next[e.u][e.v] = e.v;
        dist[e.v][e.u] = e.capacity; next[e.v][e.u] = e.u; 
    });

    nodes.forEach(k => {
        nodes.forEach(i => {
            nodes.forEach(j => {
                if (dist[i.id][k.id] !== Infinity && dist[k.id][j.id] !== Infinity && dist[i.id][k.id] + dist[k.id][j.id] < dist[i.id][j.id]) {
                    dist[i.id][j.id] = dist[i.id][k.id] + dist[k.id][j.id];
                    next[i.id][j.id] = next[i.id][k.id];
                }
            });
        });
    });

    let totalAgents = parseInt(agentSlider.value, 10);
    let targets = Array.from(targetNodes);
    let agentAssignments = clusterTargetsForAgents(targets, totalAgents);

    let finalGlobalPaths = {};
    let grandTotalCost = 0;

    saveFrame({ status: "Calculating exact Optimal Routes (Bitmask DP)..." });

    // 2. Run pure Bitmask DP for each agent on their subset of nodes
    for (let a = 0; a < totalAgents; a++) {
        if (agentAssignments[a].length === 0) continue;

        let R = [startNode, ...agentAssignments[a]];
        let N = R.length;

        // DP Table: dp[mask][ending_node]
        let dp = Array.from({length: 1 << N}, () => Array(N).fill(Infinity));
        let parent = Array.from({length: 1 << N}, () => Array(N).fill(-1));

        dp[1][0] = 0; // Mask 1 means only startNode (index 0) is visited

        for (let mask = 1; mask < (1 << N); mask++) {
            for (let u = 0; u < N; u++) {
                if (mask & (1 << u)) {
                    for (let v = 0; v < N; v++) {
                        if (!(mask & (1 << v))) {
                            let nextMask = mask | (1 << v);
                            let d = dist[R[u]][R[v]];
                            if (d !== Infinity) {
                                let newCost = dp[mask][u] + d;
                                if (newCost < dp[nextMask][v]) {
                                    dp[nextMask][v] = newCost;
                                    parent[nextMask][v] = u;
                                }
                            }
                        }
                    }
                }
            }
        }

        let fullMask = (1 << N) - 1;
        let bestLast = -1;
        let minCost = Infinity;

        for (let i = 1; i < N; i++) {
            if (dp[fullMask][i] < minCost) {
                minCost = dp[fullMask][i];
                bestLast = i;
            }
        }

        // 3. Reconstruct the edges to draw on the visualizer
        if (minCost !== Infinity) {
            grandTotalCost += minCost;

            let seq = [];
            let curr = bestLast;
            let mask = fullMask;

            while (curr !== -1) {
                seq.push(R[curr]);
                let p = parent[mask][curr];
                mask = mask ^ (1 << curr);
                curr = p;
            }
            seq.reverse(); 

            // Map sequence back to actual graph edges using `next` matrix
            for (let i = 0; i < seq.length - 1; i++) {
                let u = seq[i];
                let vTarget = seq[i+1];
                let step = u;

                while (step !== vTarget) {
                    let nxt = next[step][vTarget];
                    let edgeId1 = `${step}-${nxt}`;
                    let edgeId2 = `${nxt}-${step}`;
                    let eId = edges.find(e => e.id === edgeId1 || e.id === edgeId2)?.id;

                    if (eId) {
                        if (!finalGlobalPaths[eId]) finalGlobalPaths[eId] = [];
                        finalGlobalPaths[eId].push(a);
                    }
                    step = nxt;
                }
            }
            saveFrame({
                agentPaths: JSON.parse(JSON.stringify(finalGlobalPaths)),
                status: `Agent ${a+1} DP Optimal Route Calculated.`
            });
        }
    }

    const t1 = performance.now();
    saveFrame({
        agentPaths: finalGlobalPaths, status: "Optimal Multi-Agent TSP Calculated.", 
        finalResult: `Optimal Fleet Distance: ${grandTotalCost}km`,
        metrics: { time: formatTime(t0, t1), cost: grandTotalCost + " km", complexity: "O(K * 2^N * N²)" }
    });
}

// ==========================================
// 5. NETWORK MAX FLOW / CAPACITY (Multi-Agent)
// ==========================================
function runFordFulkersonMulti(startNode) {
    const t0 = performance.now();
    let maxFlow = 0;
    let totalAgents = parseInt(agentSlider.value, 10);
    let agentsDispatched = 0;

    let resGraph = {};
    nodes.forEach(n => resGraph[n.id] = {});
    edges.forEach(e => {
        resGraph[e.u][e.v] = { cap: e.capacity, flow: 0, isOrig: true, id: e.id };
        if(!resGraph[e.v][e.u]) resGraph[e.v][e.u] = { cap: 0, flow: 0, isOrig: false, id: `${e.v}-${e.u}` };
    });

    resGraph['SUPER'] = {};
    targetNodes.forEach(tId => {
        resGraph[tId]['SUPER'] = { cap: Infinity, flow: 0, isOrig: false, id: `temp` };
        resGraph['SUPER'][tId] = { cap: 0, flow: 0, isOrig: false, id: `temp` };
    });

    const getFlowState = () => {
        let state = {}; edges.forEach(e => state[e.id] = resGraph[e.u][e.v].flow); return state;
    };

    function dfs(u, flow, visited, parent) {
        if (u === 'SUPER') return flow;
        visited.add(u);
        for (let v in resGraph[u]) {
            v = isNaN(v) ? v : parseInt(v); 
            let edge = resGraph[u][v];
            let residualCap = edge.cap - edge.flow;
            if (!visited.has(v) && residualCap > 0) {
                parent[v] = u;
                let bottleneck = dfs(v, Math.min(flow, residualCap), visited, parent);
                if (bottleneck > 0) return bottleneck;
            }
        }
        return 0;
    }

    let globalAgentPaths = {}; 

    while(agentsDispatched < totalAgents) {
        let parent = {};
        let bottleneck = dfs(startNode, Infinity, new Set(), parent);
        if (bottleneck === 0) {
            saveFrame({ status: "Network saturated. Traffic capacity reached." }); break;
        }

        let curr = 'SUPER';
        while(curr !== startNode) {
            let p = parent[curr];
            resGraph[p][curr].flow += bottleneck;
            resGraph[curr][p].flow -= bottleneck;
            
            if(curr !== 'SUPER' && p !== 'SUPER' && resGraph[p][curr].isOrig) {
                let edgeId = resGraph[p][curr].id;
                if (!globalAgentPaths[edgeId]) globalAgentPaths[edgeId] = [];
                globalAgentPaths[edgeId].push(agentsDispatched);
            }
            curr = p;
        }
        maxFlow += bottleneck;
        
        saveFrame({ 
            agentPaths: JSON.parse(JSON.stringify(globalAgentPaths)), 
            edgeFlows: getFlowState(), 
            status: `Agent ${agentsDispatched+1} dispatched! Capacity: +${bottleneck}` 
        });
        agentsDispatched++; 
    }
    
    const t1 = performance.now();
    saveFrame({ 
        agentPaths: globalAgentPaths, edgeFlows: getFlowState(), 
        status: `Assignment Complete. Dispatched ${agentsDispatched} Agents.`, 
        finalResult: `Total Network Delivery Capacity: ${maxFlow}`,
        metrics: { time: formatTime(t0, t1), complexity: "O(E * MaxFlow)" }
    });
}

function runGreedyDelivery(start) { runMultiAgentDispatch(start); }
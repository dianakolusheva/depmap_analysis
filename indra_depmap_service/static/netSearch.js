const SUBMIT_URL = 'http://localhost:5000/query/submit';
const INDRA_DB_URL_HASH = 'https://db.indra.bio/statements/from_hash/';
const INDRA_DB_URL_AGENTS = 'https://db.indra.bio/statements/from_agents?format=html&';
const MAX_K_PATHS = 50;
const stmtOptions = ['Acetylation', 'Activation', 'ActiveForm', 'Autophosphorylation',
  'Complex', 'Conversion', 'Deacetylation', 'DecreaseAmount', 'Deglycosylation',
  'Dehydroxylation', 'Demethylation', 'Depalmitoylation', 'Dephosphorylation',
  'Deribosylation', 'Desumoylation', 'Deubiquitination', 'Farnesylation',
  'Gap', 'Gef', 'Geranylgeranylation', 'GtpActivation', 'Hydroxylation', 'IncreaseAmount',
  'Inhibition', 'Methylation', 'Myristoylation', 'Palmitoylation', 'Phosphorylation',
  'Ribosylation', 'Sumoylation', 'Translocation', 'Ubiquitination'];
var stmtItems = [];
for (s of stmtOptions) {
  stmtItems.push({
    value: s.toLowerCase(),
    label: s,
    selected: false,
    disabled: false
  })
}

const nodeOptions = ['CHEBI', 'FPLX', 'GO', 'HGNC', 'HMDB', 'MESH', 'PUBCHEM'];
var nodeItems = [];
for (let n of nodeOptions) {
  let sel = false;
  if (n === 'HGNC') sel = true;
  nodeItems.push({
    value: n.toLowerCase(),
    label: n,
    selected: sel,
    disabled: false
  })
}
$(document).ready(function() {
  const stmtFilter = new Choices('#stmt-filter', {choices: stmtItems});
  const nodeFilter = new Choices('#node-filter', {choices: nodeItems});
});

function submitQuery() {
  let beliefEntry = parseInRange(document.getElementById('belief-cutoff').value,
                                 document.getElementById('belief-cutoff').min,
                                 document.getElementById('belief-cutoff').max,
                                 false);
  let kShortestEntry = parseInRange(document.getElementById('k-shortest').value,
                                    document.getElementById('k-shortest').min,
                                    document.getElementById('k-shortest').max,
                                    true);
  let timeoutEntry = parseInRange(document.getElementById('user_timeout').value,
                                  document.getElementById('user_timeout').min,
                                  document.getElementById('user_timeout').max,
                                  false);
  var nodeFilterList = [];
  for (c of document.getElementById('node-filter').children) {
    nodeFilterList.push(c.value)
  }
  if (nodeFilterList.length === 0) {
    alert('Must select at least one node namespace to include in path');
    return;
  }
  var stmtFilterList = [];
  for (c of document.getElementById('stmt-filter').children) {
    stmtFilterList.push(c.value)
  }
  if (!document.getElementById('fplx-edges').checked) {
    stmtFilterList.push('fplx')
  }
  var nodeBlackList = [];
  for (nn of document.getElementById('node-blacklist').value.split(',')) {
    // Strip leading and trailing whitespace and push to array
    if (nn.replace(/\s/g, '')) nodeBlackList.push(nn.replace(/\s/g, ''));
  };
  var edgeHashBlacklist = [];
  for (eh of document.getElementById('edge-hash-blacklist').value.split(',')) {
    // Strip whitespace
    if (eh.replace(/\s/g, '')) edgeHashBlacklist.push(eh.replace(/\s/g, ''))
  };
  let cullBestNode = parseInt(document.getElementById('cull-best-node').value) || 0;
  if (cullBestNode && cullBestNode < 1) {
    alert('Culling best node every # paths must be positive integer');
    return;
  }
  var statusBox = document.getElementById('query-status');
  var source = document.getElementById('source').value;
  var target = document.getElementById('target').value;
  let queryDict = {
    source: source,
    target: target,
    stmt_filter: stmtFilterList,
    edge_hash_blacklist: edgeHashBlacklist,
    node_filter: nodeFilterList,
    node_blacklist: nodeBlackList,
    path_length: parseInt(document.getElementById('path-length').value) || false,
    // sign: document.getElementById('sign-dd').value,
    weighted: document.getElementById('weighted-search').checked,
    bsco: beliefEntry,
    // direct_only: document.getElementById('direct-only').checked,
    curated_db_only: document.getElementById('curated-db-only').checked,
    fplx_expand: document.getElementById('fplx-expand').checked,
    k_shortest: kShortestEntry,
    cull_best_node: cullBestNode,
    user_timeout: timeoutEntry,
    two_way: document.getElementById('two-ways').checked
  };
  let _url = SUBMIT_URL;
  statusBox.textContent = 'Query submitted...';
  console.log('Query submitted:');
  console.log(queryDict);
  let response = $.ajax({
    url: _url,
    type: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(queryDict),
    complete: function(xhr, statustText) {
      console.log(xhr);
      console.log(statustText);
      switch (xhr.status) {
        case 200:
          break;
        // ToDo Add more messages for different HTML errors
        default:
          console.log('Submission error: check ajax response');
          statusBox.textContent = 'Error: ' + xhr.status + ': ' + xhr.responseText;
          break;
      }
    }

  });
  console.log(response);
  response.then(function(json){
    resetCounters();
    clearAllTables();
    fillResultsTable(json, source, target)
  })
}

function fillResultsTable(data, source, target){
  console.log(data);
  var statusBox = document.getElementById('query-status');
  if (data.result.common_targets.length > 0 ||
      Object.keys(data.result.common_parents).length > 0 ||
      Object.keys(data.result.paths_by_node_count).length > 0) {
    if (data.result.timeout) statusBox.textContent = 'Query timed out with results!';
    else statusBox.textContent = 'Query resolved!';
    // for each path length:
    //   for each path:
    //     Output: path | list supporting statements per edge
    let commonParents = data.result.common_parents;
    let pathsKeyedArrayForward = data.result.paths_by_node_count.forward;
    let pathsKeyedArrayBackward = data.result.paths_by_node_count.backward;
    let simpleCommonTargets = data.result.common_targets;
    var tableArea = document.getElementById('table-area');

    // Fill common parents table
    if (data.result.common_parents.common_parents.length > 0) {
      let cardHtml = generateCommonParents();
      tableArea.appendChild(cardHtml);
      document.getElementById('subject-placeholder-cp').textContent =
        `${commonParents.source_id} @${commonParents.source_ns}`;
      document.getElementById('object-placeholder-cp').textContent =
        `${commonParents.target_id} @${commonParents.target_ns}`;
      let cpTableBody = document.getElementById('query-results-cp');
      document.getElementById('npaths-cp').textContent = 'Entities: ' + commonParents.common_parents.length;
      for (let par of commonParents.common_parents) {
        let newRow = document.createElement('tr');

        let newIdCol = document.createElement('td');
        let hs = '<a href="' + par + '">' + par.split('/')[par.split('/').length-1] + '</a>';
        newIdCol.innerHTML = hs;
        newRow.appendChild(newIdCol);

        let newNsCol = document.createElement('td');
        newNsCol.textContent = par.split('/')[par.split('/').length-2].toUpperCase();
        newRow.appendChild(newNsCol);

        cpTableBody.appendChild(newRow)
      }
    }

    // Fill common targets table
    if (simpleCommonTargets && simpleCommonTargets.length > 0) {
      let cardHtml = generateCommonTargets();
      tableArea.appendChild(cardHtml);
      let ctTableBody = document.getElementById('query-results-common-targets');
      document.getElementById('common-targets').textContent = 'Targets: ' +
        simpleCommonTargets.length;
      document.getElementById('subject-placeholder-ct').textContent = source;
      document.getElementById('object-placeholder-ct').textContent = target;
      for (targetDict of simpleCommonTargets) {
        for (key in targetDict) {
          if (key !== 'lowest_highest_belief') {
            let newRow = document.createElement('tr');

            let newTargetCol = document.createElement('td');
            newTargetCol.textContent = key;
            newRow.appendChild(newTargetCol);

            let newTargetPaths = document.createElement('td');
            newTargetPaths.innerHTML = generateTargetLinkout(targetDict[key]);
            newRow.appendChild(newTargetPaths);

            ctTableBody.appendChild(newRow);
          }
        }
      }
    }

    // Fill directed paths tables
    if (pathsKeyedArrayForward && Object.keys(pathsKeyedArrayForward).length > 0) {
      for (let len in pathsKeyedArrayForward) {
        let cardHtml = generateCardTable(len-1, 'f');
        tableArea.appendChild(cardHtml);
        // cardHtml.getElementById('npaths-' + (len-1)).textContent = 'Paths: ' + pathsKeyedArrayForward[len].length;
        cardHtml.getElementsByClassName('badge')[0].textContent = 'Paths: ' + pathsKeyedArrayForward[len].length;
        // cardHtml.getElementById('subject-placeholder-' + (len-1)).textContent = source;
        cardHtml.getElementsByClassName('subject-placeholder')[0].textContent = source;
        // cardHtml.getElementById('object-placeholder-' + (len-1)).textContent = target;
        cardHtml.getElementsByClassName('object-placeholder')[0].textContent = target;
        // let tableBody = cardHtml.getElementById('query-results-' + (len-1));
        let tableBody = cardHtml.getElementsByClassName('table-body')[0];
        for (let pathArray of pathsKeyedArrayForward[len]) {
          let newRow = document.createElement('tr');
          // Add current path
          let newPath = document.createElement('td');
          newPath.innerHTML = pathArray.path.join('&rarr;');
          newRow.appendChild(newPath);

          let newSupport = document.createElement('td');
          newSupport.innerHTML = generatePathLinkout(pathArray.stmts);
          newRow.appendChild(newSupport);

          tableBody.appendChild(newRow);
        }
      }
    }
    if (pathsKeyedArrayBackward && Object.keys(pathsKeyedArrayBackward).length > 0) {
      var tableArea = document.getElementById('table-area');
      for (len in pathsKeyedArrayBackward) {
        let cardHtml = generateCardTable(len-1, 'b');
        tableArea.appendChild(cardHtml);
        // cardHtml.getElementById('npaths-' + (len-1)).textContent = 'Paths: ' + pathsKeyedArrayBackward[len].length;
        cardHtml.getElementsByClassName('badge')[0].textContent = 'Paths: ' + pathsKeyedArrayBackward[len].length;
        // cardHtml.getElementById('subject-placeholder-' + (len-1)).textContent = target;
        cardHtml.getElementsByClassName('subject-placeholder')[0].textContent = target;
        // cardHtml.getElementById('object-placeholder-' + (len-1)).textContent = source;
        cardHtml.getElementsByClassName('object-placeholder')[0].textContent = source;
        // let tableBody = cardHtml.getElementById('query-results-' + (len-1));
        let tableBody = cardHtml.getElementsByClassName('table-body')[0];
        for (pathArray of pathsKeyedArrayBackward[len]) {
          let newRow = document.createElement('tr');
          // Add current path
          let newPath = document.createElement('td');
          newPath.innerHTML = pathArray.path.join('&rarr;');
          newRow.appendChild(newPath);

          let newSupport = document.createElement('td');
          newSupport.innerHTML = generatePathLinkout(pathArray.stmts);
          newRow.appendChild(newSupport);

          tableBody.appendChild(newRow);
        }
      }
    }
  } else {
    if (data.result.timeout) statusBox.textContent = 'Query timed out!';
    else statusBox.textContent = 'No path found, try expanding the search parameters';
  }
}

function clearAllTables() {
  // Delete cards
  $('.card').remove();
}

function resetCounters() {
  for (c of document.getElementsByClassName('path-count')) {
    let text = c.textContent.split(': ')[0];
    c.textContent = text + ': 0';
  }
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function parseInRange(num, min, max, int) {
  if (!num) return false;

  num = parseFloat(num);
  if (!num) return false;

  min = parseFloat(min);
  max = parseFloat(max);

  let ret = num;

  if (num < min) ret = min;
  else if (num > max) ret = max;

  if (int) ret = parseInt(ret);

  return ret;
}

// Function to put stmts from path in a HTML format with linkouts
function generatePathLinkout(pathArray) {
  // Build an html string of the paths
  // pathArray is a list of dicts for each edge in the path:
  // pathArray[i] gives a dict for the support of edge i
  // pathArray[i][stmt type j] is a list of all statements of type j supporting edge i
  // pathArray[i][stmt type j][k] is statement k of type j supporting edge i
  let htmlString = '';
  for (let edgeDict of pathArray) {
    if (Object.keys(edgeDict).length > 0) {
      let subj = edgeDict.subj;
      let obj = edgeDict.obj;
      htmlString += `<h5><b>${subj} &rarr; ${obj}</b><span class="float-right">Statement types: ${(Object.keys(edgeDict).length-2).toString()}</span></h5>`;
      for (let stmt_type in edgeDict) {
        if ((stmt_type !== 'subj') && (stmt_type !== 'obj')) {
          // let dbLink = '';
          // if (stmt.stmt_hash.startsWith('http')) dbLink = stmt.stmt_hash;
          // ?subject=BRCA1&object=BRCA2&type=activation&ev_limit=1
          let agentsString = '';
          if (stmt_type.toLowerCase() === 'complex') agentsString = `agent0=${subj}&agent1=${obj}&`;
          else agentsString = `subject=${subj}&object=${obj}&`;
          let dbLink = INDRA_DB_URL_AGENTS + agentsString + `type=${stmt_type}&ev_limit=1`;
          let sourceBadges = generateSourceBadges(edgeDict[stmt_type]);
          htmlString += '<a href="' + dbLink + '" target="_blank">' + subj + ', ' +
            stmt_type + ', ' + obj + '</a>' + sourceBadges + '<br>'
        }
      }
    }
  }
  return htmlString.substring(0, htmlString.length-4); // Cut out the last <br>
}

function generateSourceBadges(stmt_list) {
  // ToDo Add upp source counts in source dict
  let all_source_counts = {};
  for (let stmt of stmt_list) {
    let source_counts = stmt.source_counts;
    for (let source in source_counts) {
      if (all_source_counts[source]) all_source_counts[source] += source_counts[source];
      else all_source_counts[source] = source_counts[source];
    }
  }
  let htmlString = '';
  let badgeStart = '<span class="badge badge-secondary badge-pill float-right ';
  let badgeEnd = '</span>';
  for (let source in all_source_counts) {
    htmlString += badgeStart + 'source-'+ source + '">' + source + ': ' + all_source_counts[source].toString() + badgeEnd
  }
  return htmlString
}

function generateTargetLinkout(pathPair) {
  let htmlString = '';
  for (let paths of pathPair) {
    for (let path of paths) {
      let subj = path.subj;
      let obj = path.obj;
      htmlString += `<h5><b>${subj} &rarr; ${obj}</b><span class="float-right">Support: ${(Object.keys(path).length-2).toString()} + </span></h5>`;
      for (let stmt_type in path) {
        if ((stmt_type !== 'subj') && (stmt_type !== 'obj')) {
          // let dbLink = '';
          // if (stmt.stmt_hash.startsWith('http')) dbLink = stmt.stmt_hash;
          // else dbLink = INDRA_DB_URL_HASH + stmt.stmt_hash + '?format=html';
          let agentsString = '';
          if (stmt_type.toLowerCase() === 'complex') agentsString = `agent0=${subj}&agent1=${obj}&`;
          else agentsString = `subject=${subj}&object=${obj}&`;
          let dbLink = INDRA_DB_URL_AGENTS + agentsString + `type=${stmt_type}&ev_limit=1`;
          let sourceBadges = generateSourceBadges(path[stmt_type]);
          htmlString += '<a href="' + dbLink + '" target="_blank">' + subj + ', ' +
            stmt_type + ', ' + obj + '</a>' + sourceBadges + '<br>'
        }
      }
    }
  }
  return htmlString.substring(0, htmlString.length-4); // Cut out the last <br>
}

function generateCardTable(len, dir) {
  var intermArrows = '';
  if (len > 1) {
    for (let i = 1; i < len; i++) {
      intermArrows += 'X' + i + '&rarr;'
    }
  }

  let newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.innerHTML = '<div class="card-header"><h3 class="display-7"><a href="#" class="stmt_toggle" ' +
    'data-toggle="collapse" data-target="#collapse-paths-' + len + dir + ' " aria-expanded="false" ' +
    'aria-controls="collapse-paths-' + len + dir + '"> ' + len + ' Edge Paths (<div id="subject-placeholder-' +
    len + dir + '" class="placeholder subject-placeholder">A</div>&rarr;' + intermArrows +
    '<div id="object-placeholder-' + len + dir + '" class="placeholder object-placeholder">B</div>)</a><span ' +
    'id="npaths-' + len + dir + '" class="badge badge-primary badge-pill float-right path-count">Paths: ' +
    '0</span></h3></div><div id="collapse-paths-' + len + dir + '" class="collapse"><div class="card-body">' +
    '<table class="table"><thead class="table-head"><th>Path</th><th>Support</th></thead><tbody ' +
    'class="table-body" id="query-results-' + len + dir + '"></tbody></table></div></div>';
  return newCard;
}

function generateCommonParents() {
  let newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.innerHTML = '<div class="card-header"><h3 class="display-7"><a href="#" class="stmt_toggle" ' +
    'data-toggle="collapse" data-target="#collapse-paths-cp" aria-expanded="false" ' +
    'aria-controls="collapse-paths-cp">Complexes and Families (<span id="subject-placeholder-cp" ' +
    'class="placholder subject-placeholder">A</span> - <span id="object-placeholder-cp" class="placholder ' +
    'object-placeholder">B</span>)</a><span id="npaths-cp" class="badge badge-primary badge-pill float-right ' +
    'path-count">Entities: 0</span></h3></div><div id="collapse-paths-cp" class="collapse">' +
    '<div class="card-body"><table class="table"><thead class="table-head"><th>Family/Complex</th>' +
    '<th>Namespace</th></thead><tbody class="table-body" id="query-results-cp"></tbody></table></div></div>';

  return newCard;
}

function generateCommonTargets() {
  let newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.innerHTML = '<div class="card-header"><h3 class="display-7"><a href="#" class="stmt_toggle" ' +
    'data-toggle="collapse" data-target="#collapse-common-targets" aria-expanded="false" ' +
    'aria-controls="collapse-common-targets"> Common Targets (<span id="subject-placeholder-ct" ' +
    'class="placholder subject-placeholder">A</span>&rarr;Z&larr;<span id="object-placeholder-ct" '+
    'class="placholder object-placeholder">B</span>)</a><span id="common-targets" class="badge badge-primary ' +
    'badge-pill float-right path-count">Targets: 0</span></h3></div><div id="collapse-common-targets" ' +
    'class="collapse"><div class="card-body"><table class="table"><thead class="table-head"><th>Target ' +
    '(Z)</th><th>Support</th></thead><tbody class="table-body" id="query-results-common-targets"></tbody>' +
    '</table></div></div>';

  return newCard;
}

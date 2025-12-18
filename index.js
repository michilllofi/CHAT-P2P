const ui = {
  myId: document.querySelector('#my-id'),
  neighborId: document.querySelector('#neighbor-id'),
  addNeighbor: document.querySelector('#add-neighbor'),
  chat: document.querySelector('#chat'),
  dst: document.querySelector('#dst'),
  msg: document.querySelector('#msg'),
  send: document.querySelector('#send')
};

const peer = new Peer(); 
const neighbors = new Map(); 
const seenMessages = new Set();

peer.on('open', id => {
  ui.myId.value = id;
  log(`My ID: ${id}`);
});

peer.on('connection', conn => {
  setupNeighbor(conn.peer, conn);
});

ui.addNeighbor.addEventListener('click', () => {
  const id = ui.neighborId.value.trim();
  if (id) connectNeighbor(id);
});

ui.send.addEventListener('click', () => {
  const dst = ui.dst.value.trim();
  const text = ui.msg.value.trim();
  if (!dst || !text) return;

  const pkt = makeChatPacket(peer.id, dst, text, 8);
  deliver(pkt);
  renderMy(pkt);
  ui.msg.value = '';
});

function connectNeighbor(id) {
  if (neighbors.has(id)) return;
  const conn = peer.connect(id);
  setupNeighbor(id, conn);
}

function setupNeighbor(id, conn) {
  conn.on('open', () => {
    neighbors.set(id, conn);
    log(`Connected neighbor: ${id}`);
  });
  conn.on('data', data => handlePacket(data, id));
  conn.on('close', () => {
    neighbors.delete(id);
    log(`Neighbor disconnected: ${id}`);
  });
  conn.on('error', err => log(`Error with ${id}: ${err}`));
}

function makeChatPacket(src, dst, payload, ttl = 8) {
  return {
    type: 'CHAT',
    messageId: crypto.randomUUID(),
    src, dst, ttl,
    payload,
    via: [src],
    timestamp: new Date().toLocaleTimeString()
  };
}

function handlePacket(pkt, fromId) {
  if (!pkt || typeof pkt !== 'object' || !pkt.type) return;
  if (seenMessages.has(pkt.messageId)) return;
  seenMessages.add(pkt.messageId);

  pkt.via.push(peer.id);

  if (pkt.type === 'CHAT') {
    if (pkt.dst === peer.id) {
      renderFriend(pkt);
      return;
    }
    if (pkt.ttl > 0) {
      pkt.ttl -= 1;
      forward(pkt, fromId);
    }
  }
}

function forward(pkt, exceptId) {
  neighbors.forEach((conn, nid) => {
    if (nid === exceptId) return;
    conn.send(pkt);
  });
}

function deliver(pkt) {
  const direct = neighbors.get(pkt.dst);
  if (direct && direct.open) {
    direct.send(pkt);
    return;
  }
  forward(pkt, null);
}

function renderMy(pkt) {
  const div = document.createElement('div');
  div.className = 'my-msg';
  div.textContent = `Tôi tới -> ${pkt.dst}]\n${pkt.payload}\n(${pkt.timestamp}`;
  ui.chat.appendChild(div);
  autoScroll();
}

function renderFriend(pkt) {
  const div = document.createElement('div');
  div.className = 'friend-msg';
  div.textContent = `[${pkt.src} -> Tôi]\n${pkt.payload}\n(${pkt.timestamp})`;
  ui.chat.appendChild(div);
  autoScroll();
}

function log(m) {
  const div = document.createElement('div');
  div.className = 'log';
  div.textContent = m;
  ui.chat.appendChild(div);
  autoScroll();
}

function autoScroll() {
  ui.chat.scrollTop = ui.chat.scrollHeight;
}
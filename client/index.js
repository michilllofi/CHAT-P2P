const ui = {
  myId: document.querySelector('#my-id'),
  nickname: document.querySelector('#nickname'),
  neighborId: document.querySelector('#neighbor-id'),
  addNeighbor: document.querySelector('#add-neighbor'),
  chat: document.querySelector('#chat'),
  dst: document.querySelector('#dst'),
  msg: document.querySelector('#msg'),
  send: document.querySelector('#send'),
  neighborsList: document.querySelector('#neighbors-list')
};

let nickname = '';
const neighbors = new Map();
const seenMessages = new Set();

// Khởi tạo Peer
const peer = new Peer(undefined, {
  host: 'localhost',
  port: 9000,
  path: '/peerjs',
  key: 'peerjs'
});

// Khi kết nối server xong
peer.on('open', id => {
  ui.myId.value = id;
  nickname = `User-${id.slice(0,4)}`;
  ui.nickname.value = nickname;
  log(`My ID: ${id} (${nickname})`);
});

// Thay đổi nickname
ui.nickname.addEventListener('change', () => {
  const val = ui.nickname.value.trim();
  if(val) {
    nickname = val;
    log(`Nickname changed to ${nickname}`);
    broadcastHello();
  }
});

// Thêm neighbor
ui.addNeighbor.addEventListener('click', () => {
  const id = ui.neighborId.value.trim();
  if(id) connectNeighbor(id);
});

// Kết nối neighbor
function connectNeighbor(id) {
  if(neighbors.has(id)) return;
  const conn = peer.connect(id);
  setupNeighbor(id, conn);
}

// Thiết lập neighbor
function setupNeighbor(id, conn) {
  conn.on('open', () => {
    neighbors.set(id, { conn, nick: null, online: true });
    conn.send(makeHelloPacket());
    renderNeighbors();
    log(`Connected neighbor: ${id}`);
  });

  conn.on('data', data => handlePacket(data, id));
  conn.on('close', () => {
    const info = neighbors.get(id);
    if(info) info.online = false;
    renderNeighbors();
    log(`Neighbor disconnected: ${id}`);
  });
  conn.on('error', err => log(`Error with ${id}: ${err}`));
}

// Nhận kết nối mới từ neighbor
peer.on('connection', conn => setupNeighbor(conn.peer, conn));

// Tạo gói HELLO
function makeHelloPacket() {
  return { type:'HELLO', srcNick: nickname, src: peer.id };
}

// Gửi HELLO đến tất cả neighbor
function broadcastHello() {
  neighbors.forEach(info => { if(info.online) info.conn.send(makeHelloPacket()); });
}

// Tạo gói tin chat
function makeChatPacket(src, dst, payload, ttl=8) {
  return {
    type: 'CHAT',
    messageId: crypto.randomUUID(),
    src,
    srcNick: nickname,
    dst,
    ttl,
    payload,
    via: [src],
    timestamp: Date.now()
  };
}

// Xử lý gói tin
function handlePacket(pkt, fromId) {
  if(!pkt || typeof pkt !== 'object' || !pkt.type) return;

  if(pkt.type === 'HELLO') {
    const info = neighbors.get(fromId);
    if(info) { info.nick = pkt.srcNick; info.online = true; renderNeighbors(); }
    return;
  }

  if(seenMessages.has(pkt.messageId)) return;
  seenMessages.add(pkt.messageId);
  pkt.via.push(peer.id);

  if(pkt.type === 'CHAT') {
    if(pkt.dst === peer.id) {
      renderFriend(pkt);
      return;
    }
    if(pkt.ttl > 0) {
      pkt.ttl -= 1;
      forward(pkt, fromId);
    }
  }
}

// Chuyển tiếp gói tin tới các neighbor trừ exceptId
function forward(pkt, exceptId) {
  neighbors.forEach((info, id) => {
    if(id === exceptId || !info.online) return;
    info.conn.send(pkt);
  });
}

// Gửi tin nhắn trực tiếp nếu neighbor online, nếu không forward
function deliver(pkt) {
  const direct = neighbors.get(pkt.dst);
  if(direct && direct.online) { direct.conn.send(pkt); return; }
  forward(pkt, null);
}

// Click gửi tin nhắn
ui.send.addEventListener('click', () => {
  const dst = ui.dst.value.trim();
  const text = ui.msg.value.trim();
  if(!dst || !text) return;
  const pkt = makeChatPacket(peer.id, dst, text, 8);
  deliver(pkt);
  renderMy(pkt);
  ui.msg.value = '';
});

// Render tin nhắn gửi đi
function renderMy(pkt) {
  const container = document.createElement('div');
  container.className = 'my-msg-container';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble my-message';

  const dstInfo = neighbors.get(pkt.dst);
  const dstLabel = dstInfo?.nick || pkt.dst.slice(0,4);
  const time = new Date(pkt.timestamp).toLocaleTimeString();

  bubble.innerHTML =
    `[${pkt.srcNick} → ${dstLabel}]\n` +
    `${pkt.payload}\n` +
    `(${time})\n` +
    `<div class="via-text">Via: ${pkt.via.map(id => neighbors.get(id)?.nick || id.slice(0,4)).join(' → ')}</div>`;

  container.appendChild(bubble);
  ui.chat.appendChild(container);
  autoScroll();
}



// Render tin nhắn nhận
function renderFriend(pkt) {
  const container = document.createElement('div');
  container.className = 'friend-msg-container';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble friend-message';

  const nick = pkt.srcNick || pkt.src.slice(0,4);
  const time = new Date(pkt.timestamp).toLocaleTimeString();

  bubble.innerHTML =
    `[${nick} → Tôi]\n` +
    `${pkt.payload}\n` +
    `(${time})\n` +
    `<div class="via-text">Via: ${pkt.via.map(id => neighbors.get(id)?.nick || id.slice(0,4)).join(' → ')}</div>`;

  container.appendChild(bubble);
  ui.chat.appendChild(container);
  autoScroll();
}



// Log trạng thái hệ thống
function log(msg) {
  const div = document.createElement('div');
  div.className = 'log';
  div.textContent = msg;
  ui.chat.appendChild(div);
  autoScroll();
}

// Auto cuộn
function autoScroll() { ui.chat.scrollTop = ui.chat.scrollHeight; }

// Render danh sách neighbor + trạng thái
function renderNeighbors() {
  ui.neighborsList.innerHTML = '';
  neighbors.forEach((info, id) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = `status-dot ${info.online ? 'status-online' : 'status-offline'}`;
    const label = document.createElement('span');
    label.textContent = `${info.nick || id.slice(0,4)} (${id.slice(0,4)})`;
    li.appendChild(dot);
    li.appendChild(label);
    ui.neighborsList.appendChild(li);
  });
}

// Cập nhật trạng thái neighbor định kỳ
setInterval(() => {
  neighbors.forEach((info,id)=>{ if(!info.conn.open) info.online=false; });
  renderNeighbors();
}, 5000);

const ws = require('ws');
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.end();
});

const wsServer = new ws.Server({
  server,
});

const noop = () => {};

const P2PEVENTS = {
  offer: 'p2p-offer',
  answer: 'p2p-answer',
  candidate: 'p2p-candidate',
};

wsServer.on('connection', (socket, req) => {
  socket.isAlive = true;

  socket.id = Date.now();

  socket.on('open', () => {
    console.log(`CLIENT CONNECTED on ${socket.url}`);
  });

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('close', (code, reason) => {
    console.log(`CLIENT DISCONNECTED ${code} ${reason}`);
  });
  socket.on('message', (msg) => {
    const { event, data = {} } = JSON.parse(msg);
    switch (event) {
      case P2PEVENTS.offer:
        offerPeers(socket, wsServer.clients, data);
        break;
      case P2PEVENTS.answer:
        const { answer, id: orderee_id } = data;
        const client = Array.from(wsServer.clients).find((c) => c.id === orderee_id);
        client && answerPeer(client, { answer, answeree_id: socket.id });
        break;
      case P2PEVENTS.candidate:
        const { candidate } = data;
        candidatePeer(socket, wsServer.clients, { candidate });
        break;
    }
  });
});

function candidatePeer(socket, clients, data) {
  clients.forEach((client) => {
    if (client.id !== socket.id) {
      client.send(
        JSON.stringify({
          event: P2PEVENTS.candidate,
          data,
        }),
      );
    }
  });
}

function offerPeers(socket, clients, offer) {
  clients.forEach((client) => {
    if (client.id !== socket.id) {
      client.send(
        JSON.stringify({
          event: P2PEVENTS.offer,
          data: { offer, id: socket.id },
        }),
      );
    }
  });
}

function answerPeer(client, data) {
  client.send(
    JSON.stringify({
      event: P2PEVENTS.answer,
      data,
    }),
  );
}

const interval = setInterval(() => {
  wsServer.clients.forEach((socket) => {
    if (!socket.isAlive) return socket.terminate();

    socket.isAlive = false;
    socket.ping(noop);
  });
}, 1000);

wsServer.on('close', () => {
  clearInterval(interval);
});

server.listen(port, () => console.log('Start server'));

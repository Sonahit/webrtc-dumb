const freeIce = require('freeice');

const P2PEVENTS = {
  offer: 'p2p-offer',
  answer: 'p2p-answer',
  candidate: 'p2p-candidate',
};

const ws = new WebSocket('ws://localhost:3000');
/**
 * @type {HTMLVideoElement}
 */
const container = document.getElementById('video_container');
const localVideo = document.getElementById('video_stream');
const muteButton = document.getElementById('mute_button');

let remoteVideos = [];
let remoteStreams = [];
let remoteTracks = [];

const pc = new RTCPeerConnection({
  iceServers: freeIce(),
});

pc.addEventListener('icecandidate', (evt) => {
  if (evt.candidate) {
    ws.send(JSON.stringify({ event: P2PEVENTS.candidate, data: { candidate: evt.candidate } }));
  }
});

pc.addEventListener('track', (evt) => {
  console.log(evt.track, ...remoteTracks);
  if (evt.track.kind !== 'video') {
    return;
  }
  const remoteStream = new MediaStream();
  /**
   * @type {HTMLVideoElement}
   */
  const remoteVideo = document.createElement('video');
  remoteVideo.classList.add('video');
  remoteVideo.muted = true;
  remoteVideo.playsInline = true;
  remoteVideo.autoplay = true;
  remoteVideo.srcObject = remoteStream;
  remoteVideo.dataset.id = evt.track.id;

  remoteStream.addTrack(evt.track);
  remoteStreams.push(remoteStream);
  remoteVideos.push(remoteVideo);
  container.append(remoteVideo);
  remoteTracks.push(evt.track);
});

muteButton.addEventListener('click', () => {
  muteButton.textContent = !localVideo.muted ? 'unmute' : 'mute';
  localVideo.muted = !localVideo.muted;
  remoteVideos.forEach((remoteVideo) => {
    remoteVideo.muted = !remoteVideo.muted;
  });
});

(async () => {
  const device = await navigator.mediaDevices.getUserMedia({
    video: { width: 1000, height: 1000, frameRate: 60 },
    audio: true,
  });
  localVideo.srcObject = device;

  device.getTracks().forEach((v) => pc.addTrack(v, device));
  const offer = await pc.createOffer();

  pc.setLocalDescription(offer);

  ws.send(JSON.stringify({ event: P2PEVENTS.offer, data: offer.sdp }));

  ws.addEventListener('message', ({ data: msg }) => {
    const { event, data } = JSON.parse(msg);
    switch (event) {
      case P2PEVENTS.answer:
        const { answeree_id: answeree, answer } = data;
        const answDescr = new RTCSessionDescription({ sdp: answer, type: 'answer' });
        pc.setRemoteDescription(answDescr).catch(() => {});
        break;
      case P2PEVENTS.offer:
        const { offer, id } = data;
        const offerDescr = new RTCSessionDescription({ sdp: offer, type: 'offer' });
        pc.setRemoteDescription(offerDescr).catch(() => {});
        pc.createAnswer().then(async (answer) => {
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ event: P2PEVENTS.answer, data: { answer: answer.sdp, id } }));
        });
        break;
      case P2PEVENTS.candidate:
        pc.addIceCandidate(data.candidate);
        break;
      default:
        break;
    }
  });
  window.stream = device;
  // localAudio.srcObject = audioDevice;
  // obs.addEventListener('ended', () => {
  //   console.log('Obs ended');
  // });

  // obs.addEventListener('mute', () => {
  //   console.log('Muted');
  // });

  // obs.addEventListener('unmute', () => {
  //   console.log('Unmuted');
  // });

  // const rtcConnection = new RTCPeerConnection();
  // const dataChannel = rtcConnection.createDataChannel('websocket');
  // console.log(dataChannel);
})();

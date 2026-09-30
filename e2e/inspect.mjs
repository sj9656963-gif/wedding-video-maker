// 만들어진 MP4 파일 구조 검증 (Node에서 mediabunny로 디먹싱)
import fs from 'node:fs';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';

export async function inspectMp4(filePath) {
  const buf = fs.readFileSync(filePath);
  const input = new Input({ source: new BufferSource(buf), formats: ALL_FORMATS });
  const format = await input.getFormat();
  const duration = await input.computeDuration();
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  const info = {
    size: buf.length,
    format: format.name,
    mimeType: await input.getMimeType(),
    duration,
    video: null,
    audio: null,
  };
  if (video) {
    const stats = await video.computePacketStats();
    info.video = {
      codec: video.codec,
      width: video.displayWidth,
      height: video.displayHeight,
      duration: await video.computeDuration(),
      packets: stats.packetCount,
      fps: stats.averagePacketRate,
      bitrate: stats.averageBitrate,
    };
  }
  if (audio) {
    const stats = await audio.computePacketStats();
    info.audio = {
      codec: audio.codec,
      sampleRate: audio.sampleRate,
      channels: audio.numberOfChannels,
      duration: await audio.computeDuration(),
      packets: stats.packetCount,
      bitrate: stats.averageBitrate,
    };
  }
  input.dispose?.();
  return info;
}

// 단독 실행: node e2e/inspect.mjs <file.mp4>
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const file = process.argv[2];
  if (file) console.log(JSON.stringify(await inspectMp4(file), null, 2));
}

TODO: this needs repair

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';

const presets = {
  // Archival quality - preserve everything
  highQuality: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '5', // Determines the quality. Set the audio quality (codec-specific, VBR). 0 is the highest quality setting for audio. It instructs FFmpeg to allocate as much bitrate as needed to achieve the best audio quality.
    '-ar', '48000', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-af', 'aresample=resampler=soxr:precision=33:dither_method=triangular',
    '-y', out
  ],

  // High quality - transparent to most ears
  quality: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '6', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-b:a', '192k', // This sets the audio bitrate, which affects the quality and size of the audio file.
    '-ar', '44100', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-af', 'aresample=resampler=soxr:precision=28:dither_method=triangular',
    '-y', out
  ],

  // Balanced - good quality, reasonable size (default)
  balanced: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '7', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-ar', '44100', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-af', 'aresample=resampler=soxr:precision=24',
    '-y', out
  ],

  // Speed optimized - smaller file, still clear
  speed: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '7', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-b:a', '128k', // This sets the audio bitrate, which affects the quality and size of the audio file.
    '-ar', '44100', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-af', 'aresample=resampler=soxr:precision=20',
    '-y', out
  ],

  // Fast encoding - acceptable quality
  fast: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '8', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-b:a', '96k', // This sets the audio bitrate, which affects the quality and size of the audio file.
    '-ar', '22050', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-af', 'aresample=resampler=soxr',
    '-y', out
  ],

  // AM radio nostalgia - lo-fi aesthetic
  am: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '9', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-b:a', '32k', // This sets the audio bitrate, which affects the quality and size of the audio file.
    '-ar', '22050', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-ac', '1', // 	This defines the number of audio channels. 1 means you're using mono audio, which means all audio will come from a single channel, as opposed to stereo, which has two channels (left and right).
    '-af', 'highpass=f=300,lowpass=f=3000,aresample=resampler=soxr',
    '-y', out
  ],

  // Tiny - for when size matters most
  tiny: (src, out) => [
    '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'libmp3lame', // This specifies the audio codec to use for the output file. libmp3lame is the codec to create MP3 audio files. So, you're choosing to convert the audio to the MP3 format.
    '-q:a', '9', // Determines the quality. 0-5: Generally used for music, 6-9: More appropriate for spoken audio,
    '-b:a', '22k', // This sets the audio bitrate, which affects the quality and size of the audio file.
    '-ar', '8000', // This option specifies the audio sample rate, which is how many samples of audio are captured every second.
    '-ac', '1', // 	This defines the number of audio channels. 1 means you're using mono audio, which means all audio will come from a single channel, as opposed to stereo, which has two channels (left and right).
    '-af', 'highpass=f=300,lowpass=f=3000,aresample=resampler=soxr',
    '-y', out
  ],
}

const fileName = path.basename(srcFile, path.extname(srcFile)) + '.mp3';
const destFile = path.join(destDir, fileName);
const commandArguments = presets[this.options.preset](srcFile, destFile);
await transmute(commandArguments);

async function transmute(commandArguments) {
  const ffmpeg = spawn('ffmpeg', commandArguments);
  let stderr = '';

  // Capture stderr for error messages
  ffmpeg.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  // Wait for the process to complete
  const [code] = await once(ffmpeg, 'close');

  if (code !== 0) {
    throw new Error(`FFmpeg exited with code ${code}${stderr ? ': ' + stderr : ''}`);
  }
}

async function verify(srcFile, destFile, presetName) {
  // Verify output file exists and has reasonable size
  if (!fs.existsSync(destFile)) {
    throw new Error(`Output file not created: ${destFile}`);
  }

  const stats = fs.statSync(destFile);
  if (stats.size < 1000) {
    throw new Error(`Output file suspiciously small (${stats.size} bytes)`);
  }

  // Success! Show some stats
  const inputSize = fs.statSync(srcFile).size;
  const outputSize = stats.size;
  const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);
  const direction = reduction > 0 ? 'smaller' : 'larger';
  console.log(`✓ ${presetName}: ${path.basename(srcFile)} ${(inputSize / 1024).toFixed(1)}KB → ${(outputSize / 1024).toFixed(1)}KB (${Math.abs(reduction)}% ${direction})`);
}

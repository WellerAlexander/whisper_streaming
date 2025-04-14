import React, { useRef, useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import FileUploader from './components/FileUploader';
import LinearProgress from '@mui/material/LinearProgress';

type AppProps = {
  title: string;
};

const App = ({ title }: AppProps) => {
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [buttonLabel, setButtonLabel] = useState("Start Transcription");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const fileLengthRef = useRef(0);
  const [fileLength, setFileLength] = useState(0);

  const [showUploader, setShowUploader] = useState(true);

  const [ending, setEnding] = useState<string>('0.0');
  const [processed, setProcessed] = useState<string>('0.0');
  const [transcript, setTranscript] = useState<string>('');
  const [unconfirmedTranscript, setUnconfirmedTranscript] = useState<string>('');

  const [progressSent, setProgressSent] = useState(0);
  const [progressTransc, setProgressTransc] = useState(0);

  const SAMPLE_RATE = 16000; // Match backend expectations
  const CHUNK_DURATION = 0.1; // seconds
  const CHUNK_INTERVAL = CHUNK_DURATION * 0; // ms

  const selectedFileRef = useRef<File | null>(null);
  useEffect(() => {
    fileLengthRef.current = fileLength;
  }, [fileLength]);

  useEffect(() => {
    console.log("Updated progress sent:", progressSent);
  }, [progressSent]);
  useEffect(() => {
    console.log("Updated progress transcribed:", progressTransc);
  }, [progressTransc]);

  const startTranscription = async () => {
    const file = selectedFileRef.current;

    if (!file) return alert("Select a file first!");

    setButtonLabel("Transcribing")
    setIsTranscribing(true)

    const ws = new WebSocket("ws://localhost:8765");
    ws.binaryType = "arraybuffer";

    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 5000); // every 10 seconds

    ws.onclose = (e) => {
      console.warn("WebSocket closed", e);
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
    };

    ws.onopen = async () => {
      console.log("WebSocket connected, decoding audio...");
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0); // mono
      setFileLength(audioBuffer.duration);

      const chunkSize = Math.floor(SAMPLE_RATE * CHUNK_DURATION); // samples
      let offset = 0;

      const sendChunk = () => {
        if (offset >= channelData.length) {
          console.log("Done streaming audio");
          return;
        }

        const slice = channelData.slice(offset, offset + chunkSize);
        const int16 = floatTo16BitPCM(slice);
        ws.send(int16.buffer);
        console.log("Sent audio.");

        offset += chunkSize;
        setTimeout(sendChunk, CHUNK_INTERVAL);
      };

      sendChunk();
    };

    ws.onmessage = async (event) => {
      const data = event.data as string;
      console.log("Message from server:", data);

      if (data.startsWith("Data:")) {
        const msg = data.replace("Data: ", "");
        const [begStr, endStr, ...words] = msg.split(" ");
        setEnding((parseFloat(endStr) / 1000).toFixed(2).toString());

        if (fileLengthRef.current > 0) {
          const value = parseFloat(endStr) / 1000;
          setProgressTransc((value / fileLengthRef.current) * 100);
        }
        const text = words.join(" ");
        setTranscript(prev => prev + text);


      } else if (data.startsWith("Unconfirmed:")) {
        const msg = data.replace("Unconfirmed: ", "");
        const [begStr, endStr, ...words] = msg.split(" ");

        const text = words.join(" ");
        setUnconfirmedTranscript(prev => text);


      } else if (data.startsWith("Processed:")) {
        const match = data.match(/Processed:([0-9.]+)/);
        const number_val = match ? parseFloat(match[1]) : NaN;
        setProcessed((number_val).toFixed(2).toString());

        if (fileLengthRef.current > 0) {
          setProgressSent((number_val / fileLengthRef.current) * 100);
        }
      }
    }
  };



  function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const output = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  return (
    <div>
      <h1 className="highlight">{title}</h1>
      <Box marginBottom={"20px"}>
        {showUploader && (
          <Box sx={{ display: showUploader ? "block" : "none" }}>
            <FileUploader onSelect={(file) => {
              selectedFileRef.current = file;
              setShowUploader(false);
            }} />
          </Box>
        )}
        {!showUploader && (
          <Box sx={{ display: showUploader ? "none" : "block" }}>
            <Button disabled={isTranscribing} id='transcribeButton' variant='contained' onClick={startTranscription}>{buttonLabel}</Button>
          </Box>
        )}

      </Box>
      <Box display={isTranscribing ? "block" : "none"} >
        <Box display={"flex"} flex={"1"} flexDirection={'row'} marginBottom={"20px"}>
          <Box flexGrow={"1"}>
            <strong>Transcribed:</strong> {ending}
          </Box>
          <Box flexGrow={"1"}>
            <strong>Processing:</strong> {processed}
          </Box>
        </Box>
        
        <Box sx={{ width: '100%' }} marginBottom={"20px"}>
          <LinearProgress variant="buffer" value={progressTransc} valueBuffer={progressSent} />
        </Box>

        <h3>Transcript:</h3>
        <div style={{ width: "100%", whiteSpace: "pre-wrap" }}>
          <Box component="span" sx={{ color: "black", display: "inline" }}>
            {transcript}
          </Box>
          <Box component="span" sx={{ color: "gray", display: "inline" }}>
            {unconfirmedTranscript}
          </Box>
        </div>
      </Box>
    </div>
  );



};

export default App;

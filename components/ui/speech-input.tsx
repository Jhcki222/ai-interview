"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechAlternative = { transcript: string; confidence?: number };
type SpeechResult = ArrayLike<SpeechAlternative> & { isFinal: boolean };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function SpeechInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSupported(!!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      let lowConfidence = false;
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, i) => {
          const result = event.results[event.resultIndex + i];
          if (!result.isFinal || !result.length) return "";
          const alternatives = Array.from(
            { length: result.length },
            (_, alternativeIndex) => result[alternativeIndex],
          ).filter((alternative): alternative is SpeechAlternative => !!alternative);
          const best = alternatives
            .reduce((selected, alternative) =>
              (alternative.confidence ?? 0) > (selected.confidence ?? 0) ? alternative : selected,
            );
          if (best.confidence !== undefined && best.confidence < 0.65) lowConfidence = true;
          return best.transcript.trim();
        },
      )
        .filter(Boolean)
        .join(" ");
      if (!transcript) return;
      const current = valueRef.current;
      const next = `${current}${current && !/\s$/.test(current) ? " " : ""}${transcript}`;
      valueRef.current = next;
      onChange(next);
      setStatus(
        lowConfidence
          ? "인식 신뢰도가 낮은 구간이 있을 수 있어요. 내용을 확인해 주세요."
          : "인식된 내용을 확인하고 필요한 부분을 수정해 주세요.",
      );
    };
    recognition.onerror = (event) => {
      setStatus(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "마이크 권한을 허용해 주세요."
          : event.error === "no-speech"
            ? "음성이 감지되지 않았어요. 다시 시도해 주세요."
            : "음성을 인식하지 못했어요. 다시 시도해 주세요.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setStatus("한국어 음성을 듣고 있어요.");
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setStatus("음성 인식을 시작하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="speech-input-control">
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-label={listening ? "음성 인식 중지" : "한국어 음성 입력 시작"}
        aria-pressed={listening}
        title={
          supported
            ? listening
              ? "음성 인식 중지"
              : "한국어 음성 입력"
            : "Chrome 또는 Edge에서 음성 입력을 사용할 수 있습니다."
        }
        disabled={disabled || !supported}
        onClick={toggle}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      {status && (
        <span className="muted" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
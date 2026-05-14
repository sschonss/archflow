import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";

loader.config({ monaco });

interface Props {
  value: string;
  onChange: (text: string) => void;
  height?: number | string;
  error?: string | null;
}

export default function YamlEditor({ value, onChange, height = "100%", error }: Props) {
  const [text, setText] = useState(value);
  const textRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    textRef.current = value;
    setText(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      onChangeRef.current(textRef.current);
    };
  }, []);

  const handleChange = (nextValue?: string) => {
    const nextText = nextValue ?? "";
    textRef.current = nextText;
    setText(nextText);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current(nextText);
    }, 300);
  };

  return (
    <div className="yaml-editor-shell" style={{ height }}>
      <Editor
        language="yaml"
        theme="vs-dark"
        value={text}
        onChange={handleChange}
        options={{ minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false }}
      />
      {error ? <div className="yaml-error">{error}</div> : null}
    </div>
  );
}

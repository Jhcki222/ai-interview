import { FileUp } from "lucide-react";
import { useId, useRef, useState } from "react";

export function DocumentDropzone({
  label,
  disabled,
  onFiles,
}: {
  label: string;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragging, setDragging] = useState(false);
  const active = dragging && !disabled;

  return (
    <div
      className="interview-upload"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        setDragging(!disabled);
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <button
        type="button"
        className={`interview-upload-button${active ? " is-dragging" : ""}`}
        aria-label={`${label} 파일 선택`}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <span className="interview-upload-icon" aria-hidden="true">
          <FileUp size={20} />
        </span>
        <span className="interview-upload-copy">
          <span className="interview-upload-prompt">
            {active ? (
              <strong>여기에 파일 놓기</strong>
            ) : (
              <>
                <strong>파일 선택</strong>
                <span>또는 여기로 끌어다 놓기</span>
              </>
            )}
          </span>
          <span id={descriptionId} className="interview-upload-hint">
            PDF, DOCX, TXT, PNG, JPG, WEBP · 최대 3개 · 파일당 5MB
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
        multiple
        hidden
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

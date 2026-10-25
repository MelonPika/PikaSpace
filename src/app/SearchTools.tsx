import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ImageIcon, Mic, X } from "lucide-react";
import { createVoiceController, IMAGE_SEARCH_PROVIDERS, validateSearchImage } from "./search-tools.mjs";

type ToolProvider = { id: string; label: string };
type VoiceState = { phase: string; message: string; transcript: string };

function ToolDialog({ title, className = "", onClose, children }: { title: string; className?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`search-tool-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="image-upload-head"><strong>{title}</strong><button className="icon-button" type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={18} /></button></div>
    {children}
  </dialog>;
}

export function VoiceSearchDialog({ locale, query, provider, onQueryChange, onUseText, onSearch, onClose }: { locale: string; query: string; provider: ToolProvider; onQueryChange: (text: string) => void; onUseText: () => void; onSearch: () => void; onClose: () => void }) {
  const originalQuery = useRef(query);
  const [state, setState] = useState<VoiceState>({ phase: "idle", message: "Ready when you are.", transcript: "" });
  const controller = useRef<ReturnType<typeof createVoiceController> | null>(null);
  const callbacks = useRef({ onQueryChange });
  callbacks.current = { onQueryChange };
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const busy = ["requesting", "listening", "stopping"].includes(state.phase);
  useEffect(() => {
    const media = navigator.mediaDevices;
    controller.current = createVoiceController({ Recognition, getUserMedia: media?.getUserMedia?.bind(media), onState: setState, onText: (text: string) => callbacks.current.onQueryChange(text) });
    const stopWhenHidden = () => { if (document.visibilityState === "hidden") controller.current?.cancel(); };
    const stopOnExit = () => controller.current?.cancel();
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopOnExit);
    return () => { controller.current?.dispose(); document.removeEventListener("visibilitychange", stopWhenHidden); window.removeEventListener("pagehide", stopOnExit); };
  }, [Recognition]);
  function cancel() { controller.current?.cancel(); onQueryChange(originalQuery.current); onClose(); }
  function keepText() { controller.current?.cancel(); onUseText(); }
  function search() { controller.current?.cancel(); onSearch(); }
  return <ToolDialog title="Voice search" className="voice-search-dialog" onClose={cancel}>
    <p className="search-tool-description" id="voice-privacy">Your browser may send audio to its speech service for recognition, regardless of your search engine. PikaSpace does not store audio. Start listening only if you agree.</p>
    {!Recognition && <p role="status" className="search-tool-error">Voice recognition is not supported in this browser. You can still type your search.</p>}
    <div className={`voice-status ${busy ? "is-listening" : ""}`} role="status" aria-live="polite"><Mic size={22} /><span>{state.message}</span></div>
    {state.transcript && busy && <output className="voice-interim" aria-live="polite">{state.transcript}</output>}
    <label className="voice-transcript">Search text<input value={query} disabled={busy} onChange={event => onQueryChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !busy && query.trim()) { event.preventDefault(); search(); } }} /></label>
    <p className="search-tool-description">Review or edit the text, then search with {provider.label}. Nothing searches automatically.</p>
    <div className="search-tool-actions">
      <button type="button" disabled={!Recognition || busy} aria-describedby="voice-privacy" onClick={() => void controller.current?.start(locale)}>Start listening</button>
      {busy && <button type="button" disabled={state.phase !== "listening"} onClick={() => controller.current?.stop()}>Stop listening</button>}
      <button type="button" disabled={busy || !query.trim()} onClick={keepText}>Use text</button>
      <button type="button" className="primary" disabled={busy || !query.trim()} onClick={search}>Search {provider.label}</button>
      <button type="button" onClick={cancel}>Cancel</button>
    </div>
  </ToolDialog>;
}

export function ImageSearchDialog({ provider, onClose }: { provider: ToolProvider; onClose: () => void }) {
  type ImageProvider = keyof typeof IMAGE_SEARCH_PROVIDERS;
  const [imageProvider, setImageProvider] = useState<ImageProvider | null>(() => Object.hasOwn(IMAGE_SEARCH_PROVIDERS, provider.id) ? provider.id as ImageProvider : null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const currentPreview = useRef<string | null>(null);
  const target = imageProvider ? IMAGE_SEARCH_PROVIDERS[imageProvider] : null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  function select(file?: File) {
    if (!file) return; // Cancelling the OS chooser keeps the current selection.
    setHandoff(false);
    const problem = validateSearchImage(file);
    setError(problem);
    if (problem) { currentPreview.current = null; setPreview(null); setLoading(false); return; }
    const url = URL.createObjectURL(file);
    currentPreview.current = url;
    setLoading(true);
    setPreview({ url, name: file.name });
  }
  return <ToolDialog title="Image search" className="image-upload-popover" onClose={onClose}>
    {!target && <p className="search-tool-description" role="status">Image upload search is not connected for {provider.label}. Choose Google or Bing below, or cancel to keep using {provider.label}.</p>}
    <div className="image-provider-options" aria-label="Image search provider">{(Object.keys(IMAGE_SEARCH_PROVIDERS) as ImageProvider[]).map(id => <button key={id} type="button" aria-pressed={imageProvider === id} onClick={() => { setImageProvider(id); setHandoff(false); }}>{IMAGE_SEARCH_PROVIDERS[id].label}</button>)}</div>
    {target && <>
      <p className="search-tool-description">Preview an image here, then continue to {target.label}. On that page, click the camera / Search by image button and select the same file again. Your regular search engine stays {provider.label}.</p>
      <button type="button" className="image-upload-dropzone" onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select(event.dataTransfer.files?.[0]); }}>
        {preview ? <img key={preview.url} src={preview.url} alt={`Selected image: ${preview.name}`} onLoad={() => { if (currentPreview.current === preview.url) setLoading(false); }} onError={() => { if (currentPreview.current === preview.url) { currentPreview.current = null; setPreview(null); setLoading(false); setError("This file could not be read as an image. Choose a valid PNG, JPG, or WebP file."); } }} /> : <ImageIcon size={28} />}
        <span>{preview ? "Choose another image" : "Choose an image"}</span><small>{preview?.name || "PNG, JPG, or WebP · Up to 10 MB · Drop a file here or browse"}</small>
      </button>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="Choose search image" onChange={event => { select(event.target.files?.[0]); event.target.value = ""; }} />
      {loading && <p className="search-tool-description" role="status">Loading image preview…</p>}
      {error && <p className="image-upload-error" role="alert">{error}</p>}
      <p className="search-tool-description">The preview stays on this device. PikaSpace does not upload your image or send its filename. The provider receives the image only when you upload it on its own page.</p>
    </>}
    <div className="search-tool-actions">
      {target && (loading || error ? <button className="primary" type="button" disabled>{target.action}</button> : <a className="primary" href={target.url} target="_blank" rel="noopener noreferrer" onClick={() => setHandoff(true)}>{target.action}</a>)}
      <button type="button" onClick={onClose}>Cancel</button>
    </div>
    {handoff && <p className="search-tool-description" role="status">Continue in the provider tab. Use its camera button to upload{preview ? ` ${preview.name}` : " your image"}. You can close this preview when finished.</p>}
  </ToolDialog>;
}

import { Minus, Plus } from 'lucide-react';
import { useStore, EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX, EDITOR_ZOOM_STEP } from '../state/store';
import styles from './EditorZoom.module.css';

export function EditorZoom() {
  const zoom = useStore((s) => s.editorZoom);
  const setEditorZoom = useStore((s) => s.setEditorZoom);
  const atMin = zoom <= EDITOR_ZOOM_MIN;
  const atMax = zoom >= EDITOR_ZOOM_MAX;
  return (
    <div className={styles.zoom} data-testid="editor-zoom">
      <button
        type="button"
        className={styles.btn}
        disabled={atMin}
        onClick={() => setEditorZoom(zoom - EDITOR_ZOOM_STEP)}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Minus size={12} aria-hidden="true" />
      </button>
      <span className={styles.value} data-testid="editor-zoom-value">{zoom}%</span>
      <button
        type="button"
        className={styles.btn}
        disabled={atMax}
        onClick={() => setEditorZoom(zoom + EDITOR_ZOOM_STEP)}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Plus size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

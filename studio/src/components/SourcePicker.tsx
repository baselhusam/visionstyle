import { useState } from 'react';
import { api, displayName, type ImageInfo } from '../api';
import { formatTime, useStore } from '../store';
import { Icon } from './Icon';

function describe(image: ImageInfo): string {
  const parts: string[] = [];
  if (image.width && image.height) parts.push(`${image.width}×${image.height}`);
  if (image.kind === 'video') {
    if (image.duration) parts.push(formatTime(image.duration));
    if (image.fps) parts.push(`${Math.round(image.fps)} fps`);
  }
  return parts.join(' · ');
}

/** Thumbnail list of every scene the Studio knows about, with removal for uploads. */
export function SourcePicker() {
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const selectImage = useStore((s) => s.selectImage);
  const deleteImage = useStore((s) => s.deleteImage);
  const detecting = useStore((s) => s.detecting);
  const [confirm, setConfirm] = useState<string | null>(null);

  return (
    <div className="source-picker" role="radiogroup" aria-label="Source">
      {images.map((image) => {
        const active = image.id === imageId;
        const removing = confirm === image.id;
        return (
          <div key={image.id} className={`source-card ${active ? 'active' : ''} ${removing ? 'removing' : ''}`}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              className="source-card-main"
              onClick={() => { if (!active) selectImage(image.id); }}
              disabled={detecting && !active}
            >
              <span className="source-thumb">
                <img src={api.thumbnailUrl(image.id)} alt="" loading="lazy" />
                {image.kind === 'video' && <i className="source-play" aria-hidden="true">▶</i>}
              </span>
              <span className="source-text">
                <strong>{displayName(image.name)}</strong>
                <small>{describe(image)}</small>
                <span className="source-tags">
                  <span className={`source-tag ${image.kind}`}>{image.kind === 'video' ? 'Video' : 'Image'}</span>
                  {image.sample && <span className="source-tag">Sample</span>}
                  {image.kind === 'video' && image.tracked && <span className="source-tag tracked">Tracked</span>}
                </span>
              </span>
            </button>
            {!image.sample && !removing && (
              <button type="button" className="source-remove" aria-label={`Remove ${displayName(image.name)}`} title="Remove" onClick={() => setConfirm(image.id)} disabled={detecting}>×</button>
            )}
            {removing && (
              <span className="source-confirm">
                <button type="button" className="danger" onClick={() => { setConfirm(null); deleteImage(image.id); }}>Remove</button>
                <button type="button" onClick={() => setConfirm(null)}>Keep</button>
              </span>
            )}
          </div>
        );
      })}
      {images.length === 0 && <p className="muted small"><Icon name="source" /> No sources yet — upload an image or video.</p>}
    </div>
  );
}
